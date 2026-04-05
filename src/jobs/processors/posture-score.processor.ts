import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiJobStatus } from '@prisma/client';
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
      const userMessage = buildPostureScorePrompt({
        layers: dto.layers as Parameters<typeof buildPostureScorePrompt>[0]['layers'],
      });

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

      const saved = await this.prisma.postureScore.create({
        data: {
          projectId: dto.projectId,
          diagramId: dto.diagramId,
          diagramVersion: dto.diagramVersion,
          score: aggregate.score,
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
        score: saved.score,
        summary: aggregate.summary,
        topRecs: (aggregate.topRecs as string[]).slice(0, 3),
        layerCount: Array.isArray(layerScores) ? layerScores.length : 0,
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
