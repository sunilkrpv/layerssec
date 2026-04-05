import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiJobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../ai/llm.service';
import { UserSettingsService } from '../../user-settings/user-settings.service';
import { ThreatService } from '../../threat/threat.service';
import { THREAT_ANALYSIS_QUEUE } from '../queues';
import {
  buildThreatAnalysisPrompt,
  selectThreatSystemPrompt,
} from '../../ai/prompts/threat-analysis-prompt';
import { SubmitThreatAnalysisDto } from '../dto/submit-threat-analysis.dto';

export interface ThreatAnalysisJobPayload {
  aiJobId: string;
  userId: string;
  dto: SubmitThreatAnalysisDto;
  appType?: 'standard' | 'genai' | 'agentic';
  confirmedCapabilities?: string[];
}

export interface ThreatAnalysisJobResult {
  modelId: string;
  threatCount: number;
  summary: string;
  keyFindings: Array<{ category: string; count: number; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' }>;
}

@Processor(THREAT_ANALYSIS_QUEUE)
export class ThreatAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(ThreatAnalysisProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly userSettings: UserSettingsService,
    private readonly threatService: ThreatService,
  ) {
    super();
  }

  async process(job: Job<ThreatAnalysisJobPayload>): Promise<ThreatAnalysisJobResult> {
    const { aiJobId, userId, dto } = job.data;
    this.logger.log(`[ThreatAnalysis] processing job=${aiJobId} diagramId=${dto.diagramId}`);

    await this.prisma.aiJob.update({
      where: { id: aiJobId },
      data: { status: AiJobStatus.RUNNING, startedAt: new Date() },
    });

    try {
      // Build the LLM call (same logic as AiService.threatAnalysis)
      const nodeLabelMap = new Map<string, string>();
      const serializedNodes = dto.nodes
        .filter((n) => n.type !== 'trustboundary')
        .map((n) => {
          const label = n.label ?? n.id;
          nodeLabelMap.set(n.id, label);
          return { id: n.id, type: n.type ?? 'unknown', label, technology: n.technology, description: n.description, trustLevel: n.trustLevel };
        });

      const trustBoundaries = (dto.trustBoundaries ?? []).map((tb) => ({
        id: tb.id,
        label: tb.label ?? 'Trust Boundary',
        trustLevel: tb.trustLevel ?? 'custom',
      }));

      const serializedEdges = dto.edges.map((e) => ({
        id: e.id,
        from: e.source,
        to: e.target,
        fromLabel: nodeLabelMap.get(e.source) ?? e.source,
        toLabel: nodeLabelMap.get(e.target) ?? e.target,
        label: e.label,
        crossesTrustBoundary: false,
      }));

      const userMessage = buildThreatAnalysisPrompt({
        layerId: dto.layerId,
        layerName: dto.layerName ?? 'Diagram',
        nodes: serializedNodes,
        edges: serializedEdges,
        trustBoundaries,
      });

      // Resolve user LLM settings
      const settings = await this.userSettings.getAiSettings(userId);
      const providerLower = settings.provider?.toLowerCase() as 'anthropic' | 'openai' | 'ollama' | undefined;
      let apiKey: string | undefined;
      if (providerLower === 'anthropic' || providerLower === 'openai') {
        const decrypted = await this.userSettings.getDecryptedApiKey(userId, providerLower);
        apiKey = decrypted ?? undefined;
      }
      const llmConfig = { provider: providerLower, model: settings.model ?? undefined, maxOutputTokens: settings.maxOutputTokens ?? undefined, baseUrl: settings.ollamaBaseUrl ?? undefined, apiKey };

      const systemPrompt = selectThreatSystemPrompt(job.data.appType ?? 'standard');
      const startTime = Date.now();
      const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } =
        await this.llm.invoke(systemPrompt, userMessage, llmConfig);
      const durationMs = Date.now() - startTime;
      this.logger.log(`[ThreatAnalysis] job=${aiJobId} llm completed durationMs=${durationMs} tokens=${tokensUsed} (in=${inputTokens} out=${outputTokens}) model=${llmProvider}/${llmModel}`);

      const raw = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(raw) as { threats: Array<Record<string, unknown>> };
      const threats = parsed.threats.map((t) => ({ ...t, layerId: dto.layerId })) as Array<Record<string, unknown>>;

      // Resolve actual diagram version if caller passed 0 (agent chat flow)
      let resolvedVersion = dto.diagramVersion;
      if (!resolvedVersion) {
        const diagram = await this.prisma.diagram.findUnique({
          where: { id: dto.diagramId },
          select: { version: true },
        });
        resolvedVersion = diagram?.version ?? 1;
      }

      // Auto-save threat model
      const saved = await this.threatService.saveThreatModel(dto.projectId, userId, {
        name: dto.modelName ?? `Threat Analysis — ${dto.layerName ?? dto.layerId}`,
        diagramId: dto.diagramId,
        diagramVersion: resolvedVersion,
        snapshotData: { nodes: dto.nodes, edges: dto.edges },
        threats: threats as unknown as Parameters<typeof this.threatService.saveThreatModel>[2]['threats'],
      });

      // Build key findings summary for SSE result
      const severityGroups = new Map<string, Map<string, number>>();
      for (const t of threats) {
        const cat = (t.owaspCategory as string | undefined) ?? (t.strideCategory as string);
        const sev = t.severity as string;
        if (!severityGroups.has(cat)) severityGroups.set(cat, new Map());
        severityGroups.get(cat)!.set(sev, (severityGroups.get(cat)!.get(sev) ?? 0) + 1);
      }
      const keyFindings: ThreatAnalysisJobResult['keyFindings'] = [];
      for (const [cat, sevMap] of severityGroups.entries()) {
        const topSev = (['CRITICAL', 'HIGH', 'MEDIUM'] as const).find((s) => sevMap.has(s));
        if (topSev) {
          keyFindings.push({ category: cat, count: sevMap.get(topSev)!, severity: topSev });
        }
      }
      keyFindings.sort((a, b) => {
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
        return order[a.severity] - order[b.severity];
      });

      const jobResult: ThreatAnalysisJobResult = {
        modelId: saved!.id,
        threatCount: threats.length,
        summary: `Found ${threats.length} threat${threats.length !== 1 ? 's' : ''} using ${job.data.appType === 'agentic' ? 'STRIDE + OWASP LLM10 + Agentic AI Top 10' : job.data.appType === 'genai' ? 'STRIDE + OWASP LLM Top 10' : 'STRIDE + CISSP'}.`,
        keyFindings: keyFindings.slice(0, 5),
      };

      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: {
          status: AiJobStatus.COMPLETED,
          resultRef: saved!.id,
          progress: 100,
          completedAt: new Date(),
        },
      });

      await this.prisma.aiInteraction.create({
        data: {
          userId,
          diagramId: dto.diagramId,
          prompt: `[threat-analysis-job] layerId=${dto.layerId} appType=${job.data.appType ?? 'standard'} nodes=${dto.nodes?.length ?? 0}`,
          response: { threatCount: threats.length, threatModelId: saved!.id },
          tokensUsed,
          inputTokens,
          outputTokens,
          model: `${llmProvider}/${llmModel}`,
          durationMs,
        },
      });

      this.logger.log(`[ThreatAnalysis] job=${aiJobId} completed threatModelId=${saved!.id} threats=${threats.length}`);
      return jobResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[ThreatAnalysis] job=${aiJobId} failed: ${message}`);
      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: {
          status: AiJobStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
    }
  }
}
