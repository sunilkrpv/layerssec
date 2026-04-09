import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiJobStatus, ThreatStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../ai/llm.service';
import { UserSettingsService } from '../../user-settings/user-settings.service';
import { POSTURE_SCORE_QUEUE } from '../queues';
import {
  POSTURE_SCORE_SYSTEM_PROMPT,
  buildPostureScorePrompt,
  normalizePostureResult,
} from '../../ai/prompts/posture-score-prompt';
import { SubmitPostureScoreDto } from '../dto/submit-posture-score.dto';

export interface PostureScoreJobPayload {
  aiJobId: string;
  userId: string;
  dto: SubmitPostureScoreDto;
}

export interface PostureScoreJobResult {
  postureScoreId: string;
  score: number;
  summary: string;
  topRecs: string[];
  layerCount: number;
  rawLlmScore: number;
  threatPenalty: number;
}

@Processor(POSTURE_SCORE_QUEUE)
export class PostureScoreProcessor extends WorkerHost {
  private readonly logger = new Logger(PostureScoreProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly userSettings: UserSettingsService,
  ) {
    super();
  }

  async process(job: Job<PostureScoreJobPayload>): Promise<PostureScoreJobResult> {
    const { aiJobId, userId, dto } = job.data;
    this.logger.log(`[PostureScore] processing job=${aiJobId} diagramId=${dto.diagramId}`);

    await this.prisma.aiJob.update({
      where: { id: aiJobId },
      data: { status: AiJobStatus.RUNNING, startedAt: new Date() },
    });

    try {
      // ── Threat-aware scoring ──────────────────────────────────────────────
      // Phase 1: optionally load unmitigated threat counts from a linked ThreatModel.
      // Phase 2: LLM scores the architecture on structural patterns (0–100).
      // Phase 3: deterministic penalty applied post-LLM so the final score reflects
      //          actual identified risk — not just architecture quality.
      //
      // Penalty coefficients (per unmitigated threat):
      //   CRITICAL: -4 pts   HIGH: -2 pts   MEDIUM: -0.5 pts
      // Rationale: these are linear so 6 CRITICAL + 12 HIGH = -24 - 24 = -48 pts off
      // a structural 92 → final 44, which correctly represents a high-risk posture.
      // The penalty is capped so the score cannot go below 0.

      interface ThreatCounts { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number }
      const threatCounts: ThreatCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
      let threatContext = '';

      if (dto.threatModelId) {
        try {
          const model = await this.prisma.threatModel.findUnique({
            where: { id: dto.threatModelId },
            select: { threats: { select: { severity: true, status: true } } },
          });
          if (model) {
            const open = model.threats.filter(
              (t) => t.status === ThreatStatus.IDENTIFIED || t.status === ThreatStatus.IN_PROGRESS,
            );
            for (const t of open) {
              const sev = t.severity as keyof ThreatCounts;
              if (sev in threatCounts) threatCounts[sev]++;
            }
            const parts = (Object.entries(threatCounts) as [keyof ThreatCounts, number][])
              .filter(([, n]) => n > 0)
              .map(([sev, n]) => `${n} ${sev}`)
              .join(', ');
            const total = open.length;
            threatContext = total > 0
              ? `\n\nThis architecture has ${total} unmitigated threats from STRIDE analysis (${parts}). ` +
                `Score the structural patterns as usual — a deterministic penalty will be applied afterward ` +
                `based on these threat counts. Do not pre-adjust your scores.`
              : '';
          }
        } catch {
          // Non-fatal — proceed without threat context
        }
      }

      const userMessage = buildPostureScorePrompt({
        layers: dto.layers as Parameters<typeof buildPostureScorePrompt>[0]['layers'],
      }) + threatContext;

      const settings = await this.userSettings.getAiSettings(userId);
      const providerLower = settings.provider?.toLowerCase() as 'anthropic' | 'openai' | 'ollama' | undefined;
      let apiKey: string | undefined;
      if (providerLower === 'anthropic' || providerLower === 'openai') {
        const decrypted = await this.userSettings.getDecryptedApiKey(userId, providerLower);
        apiKey = decrypted ?? undefined;
      }
      const llmConfig = {
        provider: providerLower,
        model: settings.model ?? undefined,
        maxOutputTokens: settings.maxOutputTokens ?? undefined,
        baseUrl: settings.ollamaBaseUrl ?? undefined,
        apiKey,
      };

      const startTime = Date.now();
      const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } = dto.useExtendedThinking
        ? await this.llm.invokeWithThinking(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, llmConfig)
        : await this.llm.invoke(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, llmConfig);
      const durationMs = Date.now() - startTime;
      this.logger.log(`[PostureScore] job=${aiJobId} llm completed durationMs=${durationMs} tokens=${tokensUsed} (in=${inputTokens} out=${outputTokens}) model=${llmProvider}/${llmModel}`);

      const raw = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const normalized = normalizePostureResult(JSON.parse(raw) as Record<string, unknown>);
      const { aggregate, layerScores } = normalized;

      // ── Phase 3: deterministic threat penalty ─────────────────────────────
      // Applied after LLM scoring so it cannot be gamed by prompt phrasing.
      // The LLM scores structural patterns; this penalty encodes identified risk.
      const PENALTY = { CRITICAL: 4, HIGH: 2, MEDIUM: 0.5, LOW: 0 } as const;
      const rawLlmScore = aggregate.score;
      const threatPenalty = dto.threatModelId
        ? Math.round(
            threatCounts.CRITICAL * PENALTY.CRITICAL +
            threatCounts.HIGH     * PENALTY.HIGH +
            threatCounts.MEDIUM   * PENALTY.MEDIUM,
          )
        : 0;
      const finalScore = Math.max(0, rawLlmScore - threatPenalty);

      if (threatPenalty > 0) {
        this.logger.log(
          `[PostureScore] job=${aiJobId} threatPenalty=${threatPenalty} ` +
          `(${threatCounts.CRITICAL}C/${threatCounts.HIGH}H/${threatCounts.MEDIUM}M) ` +
          `llmScore=${rawLlmScore} → finalScore=${finalScore}`,
        );
        aggregate.summary =
          `[Architecture score: ${rawLlmScore}/100. Threat penalty: -${threatPenalty} ` +
          `(${threatCounts.CRITICAL} critical, ${threatCounts.HIGH} high, ${threatCounts.MEDIUM} medium unmitigated threats).] ` +
          aggregate.summary;
      }
      aggregate.score = finalScore;

      const saved = await this.prisma.postureScore.create({
        data: {
          projectId: dto.projectId,
          diagramId: dto.diagramId,
          diagramVersion: dto.diagramVersion,
          score: finalScore,
          dimensions: aggregate.dimensions as unknown as import('@prisma/client').Prisma.InputJsonValue,
          deductions: aggregate.deductions as unknown as import('@prisma/client').Prisma.InputJsonValue,
          additions: aggregate.additions as unknown as import('@prisma/client').Prisma.InputJsonValue,
          summary: aggregate.summary,
          topRecs: aggregate.topRecs as unknown as import('@prisma/client').Prisma.InputJsonValue,
          layerScores: layerScores as unknown as import('@prisma/client').Prisma.InputJsonValue,
          computedBy: userId,
          useExtended: dto.useExtendedThinking ?? false,
        },
      });

      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: {
          status: AiJobStatus.COMPLETED,
          resultRef: saved.id,
          progress: 100,
          completedAt: new Date(),
        },
      });

      await this.prisma.aiInteraction.create({
        data: {
          userId,
          diagramId: dto.diagramId,
          prompt: `[posture-score-job] projectId=${dto.projectId} extended=${dto.useExtendedThinking ?? false}`,
          response: { score: saved.score, postureScoreId: saved.id },
          tokensUsed,
          inputTokens,
          outputTokens,
          model: `${llmProvider}/${llmModel}`,
          durationMs,
        },
      });

      this.logger.log(`[PostureScore] job=${aiJobId} completed postureScoreId=${saved.id} score=${saved.score} tokens=${tokensUsed} (in=${inputTokens} out=${outputTokens}) model=${llmProvider}/${llmModel}`);

      return {
        postureScoreId: saved.id,
        score: finalScore,
        summary: aggregate.summary,
        topRecs: (aggregate.topRecs as string[]).slice(0, 3),
        layerCount: Array.isArray(layerScores) ? layerScores.length : 0,
        rawLlmScore,
        threatPenalty,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[PostureScore] job=${aiJobId} failed: ${message}`);
      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: { status: AiJobStatus.FAILED, errorMessage: message, completedAt: new Date() },
      });
      throw err;
    }
  }
}
