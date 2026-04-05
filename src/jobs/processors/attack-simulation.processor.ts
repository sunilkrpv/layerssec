import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiJobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../ai/llm.service';
import { UserSettingsService } from '../../user-settings/user-settings.service';
import { ATTACK_SIM_QUEUE } from '../queues';
import { ATTACK_MIND_SYSTEM_PROMPT, buildAttackMindPrompt } from '../../ai/prompts/attack-mind-prompt';
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
      const userMessage = buildAttackMindPrompt({
        layers: dto.layers as Parameters<typeof buildAttackMindPrompt>[0]['layers'],
        entryPointNodeId: dto.entryPointNodeId,
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
      const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } =
        dto.useExtendedThinking
          ? await this.llm.invokeWithThinking(ATTACK_MIND_SYSTEM_PROMPT, userMessage, llmConfig)
          : await this.llm.invoke(ATTACK_MIND_SYSTEM_PROMPT, userMessage, llmConfig);
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

      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: {
          status: AiJobStatus.COMPLETED,
          resultRef: saved.id,
          progress: 100,
          completedAt: new Date(),
        },
      });

      this.prisma.aiInteraction.create({
        data: {
          userId,
          diagramId: dto.diagramId,
          prompt: `[attack-mind-job] entryPoint=${dto.entryPointNodeId ?? 'auto'} extended=${dto.useExtendedThinking ?? false}`,
          response: { contentLength: content.length, simulationId: saved.id },
          tokensUsed,
          inputTokens,
          outputTokens,
          model: `${llmProvider}/${llmModel}`,
          durationMs,
        },
      }).catch((err: unknown) => this.logger.error(`[AttackSim] failed to persist aiInteraction: ${String(err)}`));

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
