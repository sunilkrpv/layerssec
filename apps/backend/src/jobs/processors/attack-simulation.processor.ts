import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiJobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../ai/llm.service';
import { UserSettingsService } from '../../user-settings/user-settings.service';
import { buildLlmConfigForUser } from '../../ai/llm-config.util';
import { OnboardingService } from '../../onboarding/onboarding.service';
import { ATTACK_SIM_QUEUE } from '../queues';
import { ATTACK_MIND_SYSTEM_PROMPT, buildAttackMindPrompt } from '../../ai/prompts/attack-mind-prompt';
import { ProjectContextHint } from '../../ai/prompts/project-context-hint';
import { SubmitAttackMindDto } from '../../ai/dto/attack-mind.dto';

export interface AttackSimJobPayload {
  aiJobId: string;
  userId: string;
  dto: SubmitAttackMindDto;
}

export interface AttackSimJobResult {
  simulationId: string;
  entryPointLabel: string;
  summary: string;       // first 500 chars of content
  contentLength: number;
}

@Processor(ATTACK_SIM_QUEUE)
export class AttackSimulationProcessor extends WorkerHost {
  private readonly logger = new Logger(AttackSimulationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly userSettings: UserSettingsService,
    private readonly onboarding: OnboardingService,
  ) {
    super();
  }

  async process(job: Job<AttackSimJobPayload>): Promise<AttackSimJobResult> {
    const { aiJobId, userId, dto } = job.data;
    this.logger.log(`[AttackSim] processing job=${aiJobId} diagramId=${dto.diagramId}`);

    await this.prisma.aiJob.update({
      where: { id: aiJobId },
      data: { status: AiJobStatus.RUNNING, startedAt: new Date() },
    });

    try {
      // Best-effort project context enrichment
      let projectContext: ProjectContextHint | undefined;
      if (dto.diagramId) {
        const diagram = await this.prisma.diagram.findUnique({
          where: { id: dto.diagramId },
          select: { project: { select: { techStack: true, environment: true, compliance: true } } },
        });
        if (diagram?.project) {
          projectContext = {
            techStack: diagram.project.techStack,
            environment: diagram.project.environment,
            compliance: diagram.project.compliance,
          };
        }
      }

      const userMessage = buildAttackMindPrompt({
        layers: dto.layers as Parameters<typeof buildAttackMindPrompt>[0]['layers'],
        entryPointNodeId: dto.entryPointNodeId,
        projectContext,
      });

      // Stamps userId so LlmService persists the interaction centrally.
      const llmConfig = await buildLlmConfigForUser(this.userSettings, userId);

      const startTime = Date.now();
      const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } =
        dto.useExtendedThinking
          ? await this.llm.invokeWithThinking(ATTACK_MIND_SYSTEM_PROMPT, userMessage, { ...llmConfig, diagramId: dto.diagramId, promptName: 'ATTACK_MIND_SYSTEM_PROMPT' })
          : await this.llm.invoke(ATTACK_MIND_SYSTEM_PROMPT, userMessage, { ...llmConfig, diagramId: dto.diagramId, promptName: 'ATTACK_MIND_SYSTEM_PROMPT' });
      const durationMs = Date.now() - startTime;
      this.logger.log(`[AttackSim] job=${aiJobId} llm completed durationMs=${durationMs} tokens=${tokensUsed} (in=${inputTokens} out=${outputTokens}) model=${llmProvider}/${llmModel}`);

      // Resolve entry point label from layers if entryPointNodeId provided
      let entryPointLabel = dto.entryPointNodeId ?? 'Auto-selected';
      if (dto.entryPointNodeId && dto.layers) {
        outer: for (const layer of Object.values(dto.layers as Record<string, { nodes?: Array<{ id: string; data?: { label?: string } }> }>)) {
          for (const node of layer.nodes ?? []) {
            if (node.id === dto.entryPointNodeId) {
              entryPointLabel = node.data?.label ?? dto.entryPointNodeId;
              break outer;
            }
          }
        }
      }

      const saved = await this.prisma.attackSimulation.create({
        data: {
          projectId: dto.projectId,
          diagramId: dto.diagramId,
          diagramVersion: dto.diagramVersion,
          name: `Attack Mind — ${new Date().toLocaleDateString()}`,
          entryPointNodeId: dto.entryPointNodeId ?? null,
          content,
          useExtended: dto.useExtendedThinking ?? false,
          savedBy: userId,
        },
      });

      this.onboarding.markFirstAttackSim(userId).catch((err) => {
        this.logger.warn(`Failed to mark firstAttackSimAt for user ${userId}: ${err.message}`);
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

      // AI interaction persisted centrally by LlmService (see llm.service.ts).
      this.logger.log(`[AttackSim] job=${aiJobId} completed simulationId=${saved.id} chars=${content.length}`);

      return {
        simulationId: saved.id,
        entryPointLabel,
        summary: content.slice(0, 500),
        contentLength: content.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[AttackSim] job=${aiJobId} failed: ${message}`);
      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: { status: AiJobStatus.FAILED, errorMessage: message, completedAt: new Date() },
      });
      throw err;
    }
  }
}
