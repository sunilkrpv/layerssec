import { Injectable, InternalServerErrorException, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { intelSynthesisPrompt } from './prompts/intel-synthesis.prompt';
import { sanitizeNodePositions, validateOversizeWarning, coerceName, extractJsonObject } from './diagram-postprocess';

// ── Exported interfaces ────────────────────────────────────────────────────

export interface IntelSnapshot {
  project: {
    name: string;
    description?: string | null;
    techStack?: string[];
    environment?: string | null;
    compliance?: string[];
    notes?: string | null;
  };
  diagrams: Array<{
    diagramId: string;
    name: string;
    version: number;
    severityCounts: Record<string, number>;
    topThreats: Array<{ title: string; severity: string; stride: string }>;
  }>;
}
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { AiJobStatus, AiJobType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { THREAT_ANALYSIS_QUEUE, POSTURE_SCORE_QUEUE, ATTACK_SIM_QUEUE } from '../jobs/queues';
import { SubmitThreatAnalysisDto } from '../jobs/dto/submit-threat-analysis.dto';
import { SubmitPostureScoreDto } from '../jobs/dto/submit-posture-score.dto';
import { LlmService, LlmCallConfig } from './llm.service';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { buildLlmConfigForUser } from './llm-config.util';
import { OnboardingService } from '../onboarding/onboarding.service';
import { SYSTEM_PROMPT } from './prompts/system-prompt';
import { buildGeneratePrompt } from './prompts/generate-prompt';
import { buildSuggestPrompt } from './prompts/suggest-prompt';
import { buildRefinePrompt } from './prompts/refine-prompt';
import { LAYERS_SYSTEM_PROMPT } from './prompts/layers-system-prompt';
import { EVAL_SYSTEM_PROMPT, QA_SYSTEM_PROMPT } from './prompts/eval-system-prompt';
import { CHAT_SYSTEM_PROMPT, buildLayerContextSystemPrompt } from './prompts/chat-system-prompt';
import { buildContextualSystemPrompt } from './prompts/contextual-system-prompt';
import { THREAT_ANALYSIS_SYSTEM_PROMPT, buildThreatAnalysisPrompt, THREAT_AGENT_SYSTEM_PROMPT, buildThreatAgentPrompt } from './prompts/threat-analysis-prompt';
import { ProjectContextHint } from './prompts/project-context-hint';
import { ThreatChatDto } from './dto/threat-chat.dto';
import { ThreatAnalysisJobPayload, ThreatAnalysisJobResult } from '../jobs/processors/threat-analysis.processor';
import { AttackSimJobPayload, AttackSimJobResult } from '../jobs/processors/attack-simulation.processor';
import { PostureScoreJobResult } from '../jobs/processors/posture-score.processor';
import { QueueEvents } from 'bullmq';
import { DECLUTTER_SYSTEM_PROMPT, buildDeclutterPrompt } from './prompts/declutter-prompt';
import { DeclutterDto } from './dto/declutter.dto';
import { POSTURE_SCORE_SYSTEM_PROMPT, buildPostureScorePrompt, normalizePostureResult } from './prompts/posture-score-prompt';
import { ATTACK_MIND_SYSTEM_PROMPT, buildAttackMindPrompt } from './prompts/attack-mind-prompt';
import { ThreatAnalysisDto } from './dto/threat-analysis.dto';
import { PostureScoreDto } from './dto/posture-score.dto';
import { AttackMindDto, SubmitAttackMindDto } from './dto/attack-mind.dto';
import { ChatService } from '../chat/chat.service';
import { RagContextService } from '../rag/rag-context.service';
import { RagIndexingService } from '../rag/rag-indexing.service';
import { ChatGenerateDto } from './dto/chat-generate.dto';
import { ChatEvaluateDto } from './dto/chat-evaluate.dto';
import { ChatAskDto } from './dto/chat-ask.dto';
import { ContextualAskDto } from './dto/contextual-ask.dto';
import { NEW_PROJECT_CONVERSE_PROMPT } from './prompts/new-project-converse-prompt';
import { parseConverse, ConverseResult } from './new-project/converse-parser';
import { ConverseDto } from './dto/converse.dto';

@Injectable()
export class AiService {

  private readonly logger = new Logger(AiService.name);
  
  constructor(
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly ragContext: RagContextService,
    private readonly ragIndexing: RagIndexingService,
    private readonly userSettingsService: UserSettingsService,
    private readonly onboarding: OnboardingService,
    @InjectQueue(THREAT_ANALYSIS_QUEUE) private readonly threatQueue: Queue,
    @InjectQueue(POSTURE_SCORE_QUEUE) private readonly postureQueue: Queue,
    @InjectQueue(ATTACK_SIM_QUEUE) private readonly attackSimQueue: Queue,
  ) {}

  private buildLlmConfig(userId: string): Promise<LlmCallConfig> {
    return buildLlmConfigForUser(this.userSettingsService, userId);
  }

  async generate(
    userId: string,
    prompt: string,
    canvasData?: Record<string, unknown>,
    diagramId?: string,
  ) {
    const userMessage = buildGeneratePrompt(prompt, canvasData);
    return this.callAi(userId, prompt, userMessage, diagramId);
  }

  async suggest(userId: string, canvasData: Record<string, unknown>) {
    const userMessage = buildSuggestPrompt(canvasData);
    return this.callAi(userId, 'Auto-suggest improvements', userMessage);
  }

  async refine(
    userId: string,
    prompt: string,
    canvasData: Record<string, unknown>,
    diagramId: string,
  ) {
    const userMessage = buildRefinePrompt(prompt, canvasData);
    return this.callAi(userId, prompt, userMessage, diagramId);
  }

  async chatGenerate(userId: string, dto: ChatGenerateDto) {

    this.logger.debug(`chatGenerate: ${dto.prompt}, projectId: ${dto.projectId}, diagramId: ${dto.diagramId}, layerId: ${dto.layerId}, layerName: ${dto.layerName}`);
    const userMessage = `Generate a diagram for: ${dto.prompt}`;
    const llmConfig = await this.buildLlmConfig(userId);
    const startTime = Date.now();
    const llmResult = await this.llm.invoke(LAYERS_SYSTEM_PROMPT, userMessage, { ...llmConfig, diagramId: dto.diagramId ?? null, promptName: 'LAYERS_SYSTEM_PROMPT' });
    const durationMs = Date.now() - startTime;
    const raw = extractJsonObject(llmResult.content);
    const diagram = JSON.parse(raw) as {
      projectName?: unknown;
      diagramName?: unknown;
      nodes: unknown[];
      edges: unknown[];
      oversizeWarning?: { reason: string; suggestedSplits: string[] };
    };
    if (!Array.isArray(diagram.nodes) || !Array.isArray(diagram.edges)) {
      throw new InternalServerErrorException('AI returned invalid diagram structure');
    }

    const sanitizedNodes = sanitizeNodePositions(diagram.nodes, (id) =>
      this.logger.warn(`[ChatGenerate] node ${id} missing valid position — defaulting`),
    );
    const oversizeWarning = validateOversizeWarning(diagram.oversizeWarning);
    const projectName = coerceName(diagram.projectName, 60);
    const diagramName = coerceName(diagram.diagramName, 80);

    // AI interaction persisted centrally by LlmService.invoke (see llm.service.ts).

    if (dto.projectId) {
      const nodeCount = sanitizedNodes.length;
      const edgeCount = diagram.edges.length;
      const baseContent = `Generated DFD with ${nodeCount} node${nodeCount !== 1 ? 's' : ''} and ${edgeCount} edge${edgeCount !== 1 ? 's' : ''}.`;
      const warningContent = oversizeWarning
        ? `\n\n⚠️ This DFD is large for a single STRIDE pass. ${oversizeWarning.reason} Consider splitting into: ${oversizeWarning.suggestedSplits.join(', ')}.`
        : '';
      await this.chat.saveMessages(dto.projectId, userId, [
        { role: 'user', content: dto.prompt, layerId: dto.layerId, layerName: dto.layerName },
        {
          role: 'assistant',
          content: `${baseContent}${warningContent}`,
          layerId: dto.layerId,
          layerName: dto.layerName,
          provider: llmResult.provider,
          model: llmResult.model,
          inputTokens: llmResult.inputTokens,
          outputTokens: llmResult.outputTokens,
        },
      ]);
    }
    return { projectName, diagramName, nodes: sanitizedNodes, edges: diagram.edges, oversizeWarning };
  }

  // ── New-project conversational DFD builder ───────────────────────────────

  async converse(userId: string, dto: ConverseDto): Promise<ConverseResult> {
    const turn = dto.messages.length;
    this.logger.log(`[new-project] turn=${turn} userId=${userId} projectId=${dto.projectId} received`);
    if (process.env.AI_DEBUG === 'true') {
      const last = dto.messages[dto.messages.length - 1]?.text ?? '';
      this.logger.log(`[new-project] input(120)="${last.slice(0, 120)}"`);
    }

    const transcript = dto.messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');
    const llmConfig = await this.buildLlmConfig(userId);
    const startTime = Date.now();
    const llmResult = await this.llm.invoke(NEW_PROJECT_CONVERSE_PROMPT, transcript, {
      ...llmConfig,
      promptName: 'NEW_PROJECT_CONVERSE_PROMPT',
    });
    const durationMs = Date.now() - startTime;

    let result: ConverseResult;
    try {
      result = parseConverse(llmResult.content, (id) =>
        this.logger.warn(`[new-project] node ${id} missing valid position — defaulting`),
      );
    } catch (err) {
      // Log only the error type by default — JSON.parse errors embed a snippet of the raw
      // LLM output (which can echo user content), so the full message is gated behind AI_DEBUG.
      const errName = err instanceof Error ? err.name : 'Error';
      this.logger.error(`[new-project] parse-failed turn=${turn} err=${errName}`);
      if (process.env.AI_DEBUG === 'true') {
        this.logger.error(`[new-project] parse-failed detail: ${String(err)}`);
      }
      // Degrade to an ask so the conversation can continue.
      result = { mode: 'ask', message: 'Could you add a bit more detail about that flow?' };
    }

    if (result.mode === 'generate') {
      const nodeCount = result.nodes.length;
      const edgeCount = result.edges.length;
      const boundaryCount = (result.nodes as Array<{ type?: string }>).filter((n) => n.type === 'trustboundary').length;
      this.logger.log(`[new-project] mode=generate turn=${turn} parsed nodes=${nodeCount} edges=${edgeCount} boundaries=${boundaryCount}`);
    } else {
      this.logger.log(`[new-project] mode=${result.mode} turn=${turn}`);
    }

    // AI interaction persisted centrally by LlmService.invoke (see llm.service.ts).
    const lastUser = [...dto.messages].reverse().find((m) => m.role === 'user')?.text ?? '';
    const assistantContent =
      result.mode === 'generate'
        ? `${result.message} (${result.nodes.length} nodes, ${result.edges.length} edges)`
        : result.message;
    await this.chat
      .saveMessages(dto.projectId, userId, [
        { role: 'user', content: lastUser },
        {
          role: 'assistant',
          content: assistantContent,
          provider: llmResult.provider,
          model: llmResult.model,
          inputTokens: llmResult.inputTokens,
          outputTokens: llmResult.outputTokens,
        },
      ])
      .catch((e: unknown) => this.logger.error(`[new-project] failed to persist chat: ${String(e)}`));

    this.logger.log(`[new-project] done turn=${turn} durationMs=${durationMs}`);
    return result;
  }

  async chatEvaluate(userId: string, dto: ChatEvaluateDto, res: Response) {
    const simplifiedNodes = (dto.nodes ?? []).map((n) => ({
      id: n.id,
      type: n.type ?? 'unknown',
      label: n.data?.label ?? n.id,
      technology: n.data?.technology,
      description: n.data?.description,
    }));
    const simplifiedEdges = (dto.edges ?? []).map((e) => ({
      from: e.source,
      to: e.target,
      label: e.label,
    }));
    const layerName = dto.layerName ?? 'Diagram';
    const diagramContext = `Layer: ${layerName}\n\nNodes:\n${JSON.stringify(simplifiedNodes, null, 2)}\n\nConnections:\n${simplifiedEdges.length ? JSON.stringify(simplifiedEdges, null, 2) : '(no edges)'}`;
    const isQA = !!dto.userQuestion;
    const userContent = isQA ? `${diagramContext}\n\nQuestion: ${dto.userQuestion}` : diagramContext;
    const systemPrompt = isQA ? QA_SYSTEM_PROMPT : EVAL_SYSTEM_PROMPT;
    const userMessageLabel = dto.userQuestion ?? 'Evaluate this diagram';

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const llmConfig = await this.buildLlmConfig(userId);
    const resolvedProvider = llmConfig.provider ?? this.llm.provider;
    const resolvedModel = llmConfig.model ?? this.llm.modelName;

    this.logger.log(`[ChatEvaluate] projectId=${dto.projectId ?? 'n/a'} isQA=${isQA} model=${resolvedProvider}/${resolvedModel}`);
    const startTime = Date.now();
    let fullResponse = '';
    try {
      for await (const chunk of this.llm.stream(systemPrompt, userContent, { ...llmConfig, promptName: isQA ? 'QA_SYSTEM_PROMPT' : 'EVAL_SYSTEM_PROMPT' })) {
        res.write(chunk);
        fullResponse += chunk;
      }
    } finally {
      const durationMs = Date.now() - startTime;
      this.logger.log(`[ChatEvaluate] completed durationMs=${durationMs} chars=${fullResponse.length} model=${resolvedProvider}/${resolvedModel}`);
      // AI interaction persisted centrally by LlmService.stream (see llm.service.ts).
      if (dto.projectId && fullResponse) {
        await this.chat.saveMessages(dto.projectId, userId, [
          { role: 'user', content: userMessageLabel, layerId: dto.layerId, layerName: dto.layerName },
          { role: 'assistant', content: fullResponse, layerId: dto.layerId, layerName: dto.layerName, provider: resolvedProvider, model: resolvedModel },
        ]);
      }
      res.end();
    }
  }

  async chatAsk(userId: string, dto: ChatAskDto, res: Response) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const systemPrompt = dto.layerContext
      ? buildLayerContextSystemPrompt(dto.layerContext)
      : CHAT_SYSTEM_PROMPT;

    const llmConfig = await this.buildLlmConfig(userId);
    const resolvedProvider = llmConfig.provider ?? this.llm.provider;
    const resolvedModel = llmConfig.model ?? this.llm.modelName;

    const startTime = Date.now();
    let fullResponse = '';
    try {
      for await (const chunk of this.llm.streamConversation(
        systemPrompt,
        dto.history ?? [],
        dto.message,
        { ...llmConfig, promptName: dto.layerContext ? 'CHAT_SYSTEM_PROMPT_WITH_LAYER_CONTEXT' : 'CHAT_SYSTEM_PROMPT' },
      )) {
        res.write(chunk);
        fullResponse += chunk;
      }
    } finally {
      const durationMs = Date.now() - startTime;
      // AI interaction persisted centrally by LlmService.streamConversation (see llm.service.ts).
      if (dto.projectId && fullResponse) {
        // Split off optional diagram JSON appended after ---DIAGRAM---
        const DIAGRAM_SEPARATOR = '---DIAGRAM---';
        const sepIdx = fullResponse.indexOf(DIAGRAM_SEPARATOR);
        let textContent = fullResponse;
        let diagramData: Record<string, unknown> | null = null;

        if (sepIdx !== -1) {
          textContent = fullResponse.slice(0, sepIdx).trim();
          const jsonStr = fullResponse.slice(sepIdx + DIAGRAM_SEPARATOR.length).trim();
          try {
            const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
            if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
              diagramData = parsed;
            }
          } catch {
            // Malformed JSON — ignore, treat whole response as text
            textContent = fullResponse;
          }
        }

        // Fallback: extract diagram from the last ```json code block in the response
        if (!diagramData) {
          const codeBlockMatches = Array.from(fullResponse.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi));
          if (codeBlockMatches.length > 0) {
            const lastMatch = codeBlockMatches[codeBlockMatches.length - 1];
            try {
              const parsed = JSON.parse(lastMatch[1].trim()) as Record<string, unknown>;
              if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
                diagramData = parsed;
                // Strip the code block from the displayed text
                textContent = fullResponse.slice(0, lastMatch.index).trim();
              }
            } catch { /* not a diagram JSON block */ }
          }
        }

        await this.chat.saveMessages(dto.projectId, userId, [
          {
            role: 'user',
            content: dto.message,
            layerId: dto.layerContext?.layerId,
            layerName: dto.layerContext?.layerName,
          },
          {
            role: 'assistant',
            content: textContent,
            layerId: dto.layerContext?.layerId,
            layerName: dto.layerContext?.layerName,
            diagramData: diagramData ?? undefined,
            provider: resolvedProvider,
            model: resolvedModel,
          },
        ]);
      }
      res.end();
    }
  }

  async contextualAsk(userId: string, dto: ContextualAskDto, res: Response) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    // Gather context from all tools in parallel (diagram info, nodes, versions, semantic memory)
    const contextBlock = await this.ragContext.gatherContext(
      userId,
      dto.projectId,
      dto.diagramId,
      dto.message,
    );

    const systemPrompt = buildContextualSystemPrompt(contextBlock);

    const llmConfig = await this.buildLlmConfig(userId);
    const resolvedProvider = llmConfig.provider ?? this.llm.provider;
    const resolvedModel = llmConfig.model ?? this.llm.modelName;

    const contextualStartTime = Date.now();
    let fullResponse = '';
    try {
      for await (const chunk of this.llm.streamConversation(
        systemPrompt,
        dto.history ?? [],
        dto.message,
        { ...llmConfig, diagramId: dto.diagramId ?? null, promptName: 'CONTEXTUAL_SYSTEM_PROMPT' },
      )) {
        res.write(chunk);
        fullResponse += chunk;
      }
    } finally {
      // AI interaction persisted centrally by LlmService.streamConversation (see llm.service.ts).
      if (fullResponse) {
        // Split diagram JSON if present
        const DIAGRAM_SEPARATOR = '---DIAGRAM---';
        const sepIdx = fullResponse.indexOf(DIAGRAM_SEPARATOR);
        let textContent = fullResponse;
        let diagramData: Record<string, unknown> | null = null;

        if (sepIdx !== -1) {
          textContent = fullResponse.slice(0, sepIdx).trim();
          try {
            const parsed = JSON.parse(fullResponse.slice(sepIdx + DIAGRAM_SEPARATOR.length).trim()) as Record<string, unknown>;
            if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
              diagramData = parsed;
            }
          } catch { textContent = fullResponse; }
        }

        // Save to chat history + index to ChromaDB
        const messages = [
          { role: 'user' as const, content: dto.message },
          { role: 'assistant' as const, content: textContent, diagramData: diagramData ?? undefined, provider: resolvedProvider, model: resolvedModel },
        ];
        await Promise.all([
          this.chat.saveMessages(dto.projectId, userId, messages),
          this.ragIndexing.indexChatMessages(dto.projectId, userId, messages),
        ]);
      }
      res.end();
    }
  }

  // ── STRIDE Threat Analysis ────────────────────────────────────────────────

  async threatAnalysis(userId: string, dto: ThreatAnalysisDto) {
    // Build node label lookup
    const nodeLabelMap = new Map<string, string>();
    const serializedNodes = dto.nodes
      .filter((n) => n.type !== 'trustboundary')
      .map((n) => {
        const label = n.label ?? n.id;
        nodeLabelMap.set(n.id, label);
        return {
          id: n.id,
          type: n.type ?? 'unknown',
          label,
          technology: n.technology,
          description: n.description,
          trustLevel: n.trustLevel,
        };
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
      crossesTrustBoundary: false, // simple heuristic — can be enhanced later
    }));

    const projectContext = await this.fetchProjectContextForDiagram(dto.diagramId);
    const userMessage = buildThreatAnalysisPrompt({
      layerId: dto.layerId,
      layerName: dto.layerName ?? 'Diagram',
      nodes: serializedNodes,
      edges: serializedEdges,
      trustBoundaries,
      projectContext,
    });

    this.logger.log(`[ThreatAnalysis] diagramId=${dto.diagramId} layerId=${dto.layerId} nodes=${dto.nodes.length}`);

    const llmConfig = await this.buildLlmConfig(userId);
    const startTime = Date.now();
    const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } =
      await this.llm.invoke(THREAT_ANALYSIS_SYSTEM_PROMPT, userMessage, { ...llmConfig, diagramId: dto.diagramId, promptName: 'THREAT_ANALYSIS_SYSTEM_PROMPT' });
    const durationMs = Date.now() - startTime;
    this.logger.log(`[ThreatAnalysis] completed durationMs=${durationMs} tokens=${tokensUsed} (in=${inputTokens} out=${outputTokens}) model=${llmProvider}/${llmModel}`);

    const raw = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(raw) as { threats: unknown[] };
    if (!Array.isArray(parsed.threats)) {
      throw new InternalServerErrorException('AI returned invalid threat analysis structure');
    }

    // Attach layerId to each threat
    const threats = (parsed.threats as Array<Record<string, unknown>>).map((t) => ({
      ...t,
      layerId: dto.layerId,
    }));

    // AI interaction persisted centrally by LlmService.invoke (see llm.service.ts).
    return { threats };
  }

  // ── Declutter Layout ─────────────────────────────────────────────────────

  async declutter(userId: string, dto: DeclutterDto): Promise<{ positions: Record<string, { x: number; y: number }>; jobId: string }> {
    const nodeSummary = dto.nodes.map((n) => ({
      id: n.id,
      type: n.type ?? 'unknown',
      label: n.data?.label ?? n.id,
      x: n.position?.x ?? 0,
      y: n.position?.y ?? 0,
      width: n.style?.width ?? n.width ?? 160,
      height: n.style?.height ?? n.height ?? 80,
      parentNode: n.parentNode ?? null,
    }));

    const edgeSummary = dto.edges.map((e) => ({ source: e.source, target: e.target }));

    // Create activity-log entry up-front so the job is visible in the feed
    // while the LLM runs. This is a synchronous job (not BullMQ-backed) —
    // the client blocks on the response to apply positions to the canvas.
    const aiJob = await this.prisma.aiJob.create({
      data: {
        userId,
        projectId: dto.projectId ?? null,
        diagramId: dto.diagramId ?? null,
        layerId: dto.layerId ?? null,
        type: AiJobType.DECLUTTER,
        status: AiJobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    const userMessage = buildDeclutterPrompt(nodeSummary, edgeSummary);
    const llmConfig = await this.buildLlmConfig(userId);

    this.logger.log(`[Declutter] job=${aiJob.id} nodes=${dto.nodes.length} edges=${dto.edges.length}`);
    const startTime = Date.now();
    try {
      const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } =
        await this.llm.invoke(DECLUTTER_SYSTEM_PROMPT, userMessage, { ...llmConfig, diagramId: dto.diagramId ?? null, promptName: 'DECLUTTER_SYSTEM_PROMPT' });
      const durationMs = Date.now() - startTime;
      this.logger.log(`[Declutter] job=${aiJob.id} completed durationMs=${durationMs} tokens=${tokensUsed} (in=${inputTokens} out=${outputTokens}) model=${llmProvider}/${llmModel}`);

      const raw = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const result = JSON.parse(raw) as { positions: Record<string, { x: number; y: number }> };
      if (!result.positions || typeof result.positions !== 'object') {
        throw new InternalServerErrorException('AI returned invalid declutter response');
      }

      await this.prisma.aiJob.update({
        where: { id: aiJob.id },
        data: { status: AiJobStatus.COMPLETED, progress: 100, completedAt: new Date() },
      });

      // AI interaction persisted centrally by LlmService.invoke (see llm.service.ts).
      return { ...result, jobId: aiJob.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Declutter] job=${aiJob.id} failed: ${message}`);
      await this.prisma.aiJob.update({
        where: { id: aiJob.id },
        data: { status: AiJobStatus.FAILED, errorMessage: message, completedAt: new Date() },
      });
      throw err;
    }
  }

  // ── Security Posture Score ───────────────────────────────────────────────

  async postureScore(userId: string, dto: PostureScoreDto) {
    const userMessage = buildPostureScorePrompt({ layers: dto.layers as Parameters<typeof buildPostureScorePrompt>[0]['layers'] });

    this.logger.log(`[PostureScore] projectId=${dto.projectId} diagramId=${dto.diagramId} extended=${dto.useExtendedThinking ?? false}`);
    this.logger.debug(`[PostureScore] user message length: ${userMessage.length} chars`);

    const llmConfig = await this.buildLlmConfig(userId);
    const startTime = Date.now();
    const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } = dto.useExtendedThinking
      ? await this.llm.invokeWithThinking(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, { ...llmConfig, diagramId: dto.diagramId, promptName: 'POSTURE_SCORE_SYSTEM_PROMPT' })
      : await this.llm.invoke(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, { ...llmConfig, diagramId: dto.diagramId, promptName: 'POSTURE_SCORE_SYSTEM_PROMPT' });

    const durationMs = Date.now() - startTime;
    this.logger.log(`[PostureScore] completed durationMs=${durationMs} tokens=${tokensUsed} (in=${inputTokens} out=${outputTokens}) model=${llmProvider}/${llmModel}`);

    const raw = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const normalized = normalizePostureResult(JSON.parse(raw) as Record<string, unknown>);
    const { aggregate, layerScores } = normalized;

    this.logger.debug(`[PostureScore] layers scored: ${Object.keys(layerScores).join(', ')}`);

    // Persist to DB
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

    this.logger.log(`[PostureScore] saved id=${saved.id} score=${saved.score}`);

    this.onboarding.markFirstPostureScore(userId).catch((err) => {
      this.logger.warn(`Failed to mark firstPostureScoreAt for user ${userId}: ${err.message}`);
    });

    // AI interaction persisted centrally by LlmService (see llm.service.ts).
    return saved;
  }

  // ── Attack Mind Simulator ────────────────────────────────────────────────

  async attackMind(userId: string, dto: AttackMindDto, res: import('express').Response) {
    const projectContext = await this.fetchProjectContextForDiagram(dto.diagramId);
    const userMessage = buildAttackMindPrompt({
      layers: dto.layers as Parameters<typeof buildAttackMindPrompt>[0]['layers'],
      entryPointNodeId: dto.entryPointNodeId,
      projectContext,
    });

    this.logger.log(`[AttackMind] projectId=${dto.projectId} diagramId=${dto.diagramId} entryPoint=${dto.entryPointNodeId ?? 'auto'} extended=${dto.useExtendedThinking ?? false}`);
    this.logger.debug(`[AttackMind] user message length: ${userMessage.length} chars`);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const llmConfig = await this.buildLlmConfig(userId);
    const resolvedProvider = llmConfig.provider ?? this.llm.provider;
    const resolvedModel = llmConfig.model ?? this.llm.modelName;
    const startTime = Date.now();
    let fullResponse = '';
    let tokensUsed = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      if (dto.useExtendedThinking) {
        this.logger.log('[AttackMind] using extended thinking — blocking invoke');
        const result = await this.llm.invokeWithThinking(ATTACK_MIND_SYSTEM_PROMPT, userMessage, { ...llmConfig, diagramId: dto.diagramId, promptName: 'ATTACK_MIND_SYSTEM_PROMPT' });
        fullResponse = result.content;
        tokensUsed = result.tokensUsed;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        res.write(fullResponse);
        this.logger.log(`[AttackMind] extended thinking completed durationMs=${Date.now() - startTime} tokens=${tokensUsed} (in=${inputTokens} out=${outputTokens}) model=${result.provider}/${result.model}`);
      } else {
        for await (const chunk of this.llm.stream(ATTACK_MIND_SYSTEM_PROMPT, userMessage, { ...llmConfig, diagramId: dto.diagramId, promptName: 'ATTACK_MIND_SYSTEM_PROMPT' })) {
          res.write(chunk);
          fullResponse += chunk;
        }
        this.logger.log(`[AttackMind] standard stream completed durationMs=${Date.now() - startTime} chars=${fullResponse.length} model=${resolvedProvider}/${resolvedModel}`);
      }
    } finally {
      // AI interaction persisted centrally by LlmService (see llm.service.ts).
      res.end();
    }
  }

  // ── Project context helper ───────────────────────────────────────────────

  private async fetchProjectContextForDiagram(diagramId?: string): Promise<ProjectContextHint | undefined> {
    if (!diagramId) return undefined;
    const diagram = await this.prisma.diagram.findUnique({
      where: { id: diagramId },
      select: { project: { select: { techStack: true, environment: true, compliance: true } } },
    });
    if (!diagram?.project) return undefined;
    return {
      techStack: diagram.project.techStack,
      environment: diagram.project.environment,
      compliance: diagram.project.compliance,
    };
  }

  // ── Async job submission ─────────────────────────────────────────────────

  async submitThreatAnalysis(userId: string, dto: SubmitThreatAnalysisDto): Promise<{ jobId: string }> {
    const job = await this.prisma.aiJob.create({
      data: {
        userId,
        projectId: dto.projectId,
        diagramId: dto.diagramId,
        layerId: dto.layerId,
        type: AiJobType.THREAT_ANALYSIS,
        status: AiJobStatus.PENDING,
      },
    });
    await this.threatQueue.add(
      'run',
      { aiJobId: job.id, userId, dto },
      { removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } },
    );
    this.logger.log(`[SubmitThreatAnalysis] queued job=${job.id} diagramId=${dto.diagramId}`);
    return { jobId: job.id };
  }

  async submitPostureScore(userId: string, dto: SubmitPostureScoreDto): Promise<{ jobId: string }> {
    const job = await this.prisma.aiJob.create({
      data: {
        userId,
        projectId: dto.projectId,
        diagramId: dto.diagramId,
        type: AiJobType.POSTURE_SCORE,
        status: AiJobStatus.PENDING,
      },
    });
    await this.postureQueue.add(
      'run',
      { aiJobId: job.id, userId, dto },
      { removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } },
    );
    this.logger.log(`[SubmitPostureScore] queued job=${job.id} diagramId=${dto.diagramId}`);
    return { jobId: job.id };
  }

  async getPipelineStatus(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException();

    const [threatJob, postureJob] = await Promise.all([
      this.prisma.aiJob.findFirst({
        where: { projectId, type: AiJobType.THREAT_ANALYSIS },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, resultRef: true,
          errorMessage: true, createdAt: true, completedAt: true,
        },
      }),
      this.prisma.aiJob.findFirst({
        where: { projectId, type: AiJobType.POSTURE_SCORE },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, resultRef: true,
          errorMessage: true, createdAt: true, completedAt: true,
        },
      }),
    ]);

    return { threatJob, postureJob };
  }

  async getPipelineStatusForDiagram(userId: string, diagramId: string) {
    const diagram = await this.prisma.diagram.findUnique({
      where: { id: diagramId },
      include: { project: { select: { ownerId: true } } },
    });
    if (!diagram) throw new NotFoundException('Diagram not found');
    if (diagram.project.ownerId !== userId) throw new ForbiddenException();

    const [threatJob, postureJob] = await Promise.all([
      this.prisma.aiJob.findFirst({
        where: { diagramId, type: AiJobType.THREAT_ANALYSIS },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, resultRef: true,
          errorMessage: true, createdAt: true, completedAt: true,
        },
      }),
      this.prisma.aiJob.findFirst({
        where: { diagramId, type: AiJobType.POSTURE_SCORE },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, resultRef: true,
          errorMessage: true, createdAt: true, completedAt: true,
        },
      }),
    ]);

    return { threatJob, postureJob };
  }

  // ── Threat Agent Chat (multi-turn, typed SSE) ────────────────────────────────

  async threatAgentChat(userId: string, dto: ThreatChatDto, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const writeEvent = (name: string, data?: unknown) => {
      const payload = data !== undefined ? JSON.stringify(data) : '{}';
      res.write(`event: ${name}\ndata: ${payload}\n\n`);
    };

    const agentStartTime = Date.now();
    try {
      const nodeLabelMap = new Map<string, string>();
      const serializedNodes = dto.nodes
        .filter((n) => n.type !== 'trustboundary')
        .map((n) => {
          const label = n.label ?? n.id;
          nodeLabelMap.set(n.id, label);
          return { id: n.id, type: n.type ?? 'unknown', label, technology: n.technology, description: n.description, trustLevel: n.trustLevel };
        });

      const serializedEdges = dto.edges.map((e) => ({
        id: e.id,
        from: e.source,
        to: e.target,
        fromLabel: nodeLabelMap.get(e.source) ?? e.source,
        toLabel: nodeLabelMap.get(e.target) ?? e.target,
        label: e.label,
        crossesTrustBoundary: false,
      }));

      const trustBoundaries = (dto.trustBoundaries ?? []).map((tb) => ({
        id: tb.id,
        label: tb.label ?? 'Trust Boundary',
        trustLevel: tb.trustLevel ?? 'custom',
      }));

      const userMessage = buildThreatAgentPrompt({
        diagramSnapshot: {
          layerName: dto.layerName ?? 'Diagram',
          nodes: serializedNodes,
          edges: serializedEdges,
          trustBoundaries,
        },
        conversationHistory: dto.messages,
      });

      const llmConfig = await this.buildLlmConfig(userId);

      // Collect full LLM response so we can strip [ANALYSIS_CONTEXT] before sending.
      // Use stream() not streamConversation() — history is already embedded in userMessage
      // by buildThreatAgentPrompt, so passing dto.messages again would duplicate it.
      let fullResponse = '';
      for await (const chunk of this.llm.stream(THREAT_AGENT_SYSTEM_PROMPT, userMessage, { ...llmConfig, diagramId: dto.diagramId, promptName: 'THREAT_AGENT_SYSTEM_PROMPT' })) {
        fullResponse += chunk;
      }

      // Strip [ANALYSIS_CONTEXT:{...}] marker — must not reach the client
      const MARKER_RE = /\[ANALYSIS_CONTEXT:(\{[\s\S]*?\})\]/;
      const markerMatch = MARKER_RE.exec(fullResponse);
      const cleanResponse = fullResponse.replace(MARKER_RE, '').trim();

      writeEvent('message', { delta: cleanResponse });
      writeEvent('message_done');

      // Determine the user content from last user turn (first turn uses a synthetic message)
      const lastUserMsg = [...dto.messages].reverse().find((m) => m.role === 'user');
      const userContent = lastUserMsg?.content ?? 'Analyze this diagram';

      // AI interaction persisted centrally by LlmService.stream (see llm.service.ts).
      await this.chat.saveMessages(dto.projectId, userId, [
        { role: 'user', content: userContent, layerId: '__threat_analysis__', layerName: 'Threat Analysis' },
        { role: 'assistant', content: cleanResponse, layerId: '__threat_analysis__', layerName: 'Threat Analysis' },
      ]);

      // Non-blocking ChromaDB indexing
      this.ragIndexing.indexThreatChatMessages(dto.projectId, userId, [
        { role: 'user', content: userContent, layerId: '__threat_analysis__', layerName: 'Threat Analysis' },
        { role: 'assistant', content: cleanResponse, layerId: '__threat_analysis__', layerName: 'Threat Analysis' },
      ]).catch(() => {});

      // If the LLM signaled analysis readiness, submit the job
      if (markerMatch) {
        let analysisContext: { appType?: string; confirmedCapabilities?: string[] } = {};
        try {
          analysisContext = JSON.parse(markerMatch[1]) as typeof analysisContext;
        } catch {
          this.logger.warn('[ThreatAgentChat] Failed to parse ANALYSIS_CONTEXT marker JSON');
        }

        const appType = (analysisContext.appType ?? 'standard') as 'standard' | 'genai' | 'agentic';
        const confirmedCapabilities = analysisContext.confirmedCapabilities ?? [];

        const jobRecord = await this.prisma.aiJob.create({
          data: {
            userId,
            projectId: dto.projectId,
            diagramId: dto.diagramId,
            layerId: dto.layerId,
            type: AiJobType.THREAT_ANALYSIS,
            status: AiJobStatus.PENDING,
          },
        });

        const jobPayload: ThreatAnalysisJobPayload = {
          aiJobId: jobRecord.id,
          userId,
          dto: {
            projectId: dto.projectId,
            diagramId: dto.diagramId,
            diagramVersion: 0, // processor resolves actual version from DB
            layerId: dto.layerId,
            layerName: dto.layerName,
            nodes: dto.nodes as SubmitThreatAnalysisDto['nodes'],
            edges: dto.edges as SubmitThreatAnalysisDto['edges'],
            trustBoundaries: dto.trustBoundaries as SubmitThreatAnalysisDto['trustBoundaries'],
          },
          appType,
          confirmedCapabilities,
        };

        const bullJob = await this.threatQueue.add(
          'run',
          jobPayload,
          { removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } },
        );

        writeEvent('analysis_triggered', { jobId: jobRecord.id });
        this.logger.log(`[ThreatAgentChat] analysis triggered, jobId=${jobRecord.id} appType=${appType}`);

        // Keep SSE open until job completes (up to 120s)
        const queueEvents = new QueueEvents(THREAT_ANALYSIS_QUEUE, {
          connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
        });
        try {
          const result = await bullJob.waitUntilFinished(queueEvents, 120_000) as ThreatAnalysisJobResult;
          writeEvent('analysis_complete', result);
          this.logger.log(`[ThreatAgentChat] analysis_complete jobId=${jobRecord.id} threats=${result.threatCount}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`[ThreatAgentChat] job wait failed: ${msg}`);
          writeEvent('error', { message: 'Threat analysis timed out or failed. Check Threat Model Panel for results.' });
        } finally {
          await queueEvents.close();
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[ThreatAgentChat] error: ${message}`);
      writeEvent('error', { message });
    } finally {
      res.end();
    }
  }

  // ── Posture Score Stream (SSE) ────────────────────────────────────────────
  async postureScoreStream(userId: string, dto: SubmitPostureScoreDto, res: import('express').Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const writeEvent = (name: string, data?: unknown) => {
      const payload = data !== undefined ? JSON.stringify(data) : '{}';
      res.write(`event: ${name}\ndata: ${payload}\n\n`);
    };

    try {
      const jobRecord = await this.prisma.aiJob.create({
        data: {
          userId,
          projectId: dto.projectId,
          diagramId: dto.diagramId,
          type: AiJobType.POSTURE_SCORE,
          status: AiJobStatus.PENDING,
        },
      });

      const bullJob = await this.postureQueue.add(
        'run',
        { aiJobId: jobRecord.id, userId, dto },
        { removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } },
      );

      writeEvent('job_submitted', { jobId: jobRecord.id });
      this.logger.log(`[PostureScoreStream] jobId=${jobRecord.id} submitted`);

      const queueEvents = new QueueEvents(POSTURE_SCORE_QUEUE, {
        connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
      });
      try {
        const result = await bullJob.waitUntilFinished(queueEvents, 300_000) as PostureScoreJobResult;
        writeEvent('job_complete', result);
        this.logger.log(`[PostureScoreStream] jobId=${jobRecord.id} complete score=${result.score}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[PostureScoreStream] jobId=${jobRecord.id} wait failed: ${msg}`);
        writeEvent('error', { message: 'Posture score analysis timed out or failed.' });
      } finally {
        await queueEvents.close();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[PostureScoreStream] error: ${message}`);
      writeEvent('error', { message });
    } finally {
      res.end();
    }
  }

  // ── Attack Mind Stream (SSE) ─────────────────────────────────────────────
  async attackMindStream(userId: string, dto: SubmitAttackMindDto, res: import('express').Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const writeEvent = (name: string, data?: unknown) => {
      const payload = data !== undefined ? JSON.stringify(data) : '{}';
      res.write(`event: ${name}\ndata: ${payload}\n\n`);
    };

    try {
      const jobRecord = await this.prisma.aiJob.create({
        data: {
          userId,
          projectId: dto.projectId,
          diagramId: dto.diagramId,
          type: AiJobType.ATTACK_SIMULATION,
          status: AiJobStatus.PENDING,
        },
      });

      const bullJob = await this.attackSimQueue.add(
        'run',
        { aiJobId: jobRecord.id, userId, dto } as AttackSimJobPayload,
        { removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } },
      );

      writeEvent('job_submitted', { jobId: jobRecord.id });
      this.logger.log(`[AttackMindStream] jobId=${jobRecord.id} submitted`);

      const queueEvents = new QueueEvents(ATTACK_SIM_QUEUE, {
        connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
      });
      try {
        const result = await bullJob.waitUntilFinished(queueEvents, 300_000) as AttackSimJobResult;
        writeEvent('job_complete', result);
        this.logger.log(`[AttackMindStream] jobId=${jobRecord.id} complete simId=${result.simulationId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[AttackMindStream] jobId=${jobRecord.id} wait failed: ${msg}`);
        writeEvent('error', { message: 'Attack Mind simulation timed out or failed.' });
      } finally {
        await queueEvents.close();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[AttackMindStream] error: ${message}`);
      writeEvent('error', { message });
    } finally {
      res.end();
    }
  }

  // ── Security Intel Synthesis ─────────────────────────────────────────────

  async intelSynthesis(
    userId: string,
    dto: {
      projectId: string;
      threatModelId: string;
      postureScoreId: string;
      attackSimulationId?: string;
    },
  ): Promise<{ executiveSummary: string; priorityActions: Array<{ rank: number; severity: string; source: string; title: string; detail: string }> }> {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { ownerId: true, name: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException();

    const [threatModel, postureScore, attackSim] = await Promise.all([
      this.prisma.threatModel.findUnique({
        where: { id: dto.threatModelId },
        include: {
          threats: {
            select: { title: true, strideCategory: true, severity: true, status: true, targetLabel: true, mitigationNotes: true },
            orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
          },
        },
      }),
      this.prisma.postureScore.findUnique({
        where: { id: dto.postureScoreId },
        select: { score: true, summary: true, topRecs: true },
      }),
      dto.attackSimulationId
        ? this.prisma.attackSimulation.findUnique({
            where: { id: dto.attackSimulationId },
            select: { entryPointNodeId: true, content: true },
          })
        : Promise.resolve(null),
    ]);

    if (!threatModel) throw new NotFoundException('Threat model not found');
    if (!postureScore) throw new NotFoundException('Posture score not found');

    const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    const counts: Record<string, number> = {};
    for (const t of threatModel.threats) counts[t.severity] = (counts[t.severity] ?? 0) + 1;

    const topThreats = threatModel.threats
      .filter(t => t.status !== 'MITIGATED' && t.status !== 'FALSE_POSITIVE')
      .slice(0, 5)
      .map(t => `- [${t.strideCategory}] ${t.targetLabel ?? 'Unknown'}: ${t.mitigationNotes ?? t.title}`)
      .join('\n');

    const topRecs = Array.isArray(postureScore.topRecs)
      ? (postureScore.topRecs as string[]).map((r, i) => `${i + 1}. ${r}`).join('\n')
      : '';

    const attackContext = attackSim
      ? `Entry Point: ${attackSim.entryPointNodeId ?? 'Auto-selected'}\n${attackSim.content.slice(0, 1500)}`
      : 'No attack simulation provided.';

    const userMessage = `## Architecture Posture
Score: ${postureScore.score}/100
Summary: ${postureScore.summary}
Top Recommendations:
${topRecs}

## Threat Analysis (${threatModel.name})
${severityOrder.filter(s => counts[s]).map(s => `${counts[s]} ${s}`).join(', ')} threats identified.
Top open threats:
${topThreats}

## Attack Simulation
${attackContext}

## Task
Return valid JSON only (no markdown wrapper):
{
  "executiveSummary": "3-5 sentence paragraph for a technical audience. Name specific nodes or flows where possible. Be direct about the risk level.",
  "priorityActions": [
    {
      "rank": 1,
      "severity": "critical",
      "source": "threat",
      "title": "short action title (max 80 chars)",
      "detail": "one sentence explaining why and what to do"
    }
  ]
}
Return 5-7 priorityActions max, ranked by risk impact. severity must be one of: critical, high, medium, low. source must be one of: threat, posture, attack.`;

    const systemPrompt = `You are a senior security architect writing a concise risk assessment. Output valid JSON only. No markdown code blocks, no text before or after the JSON.`;

    const llmConfig = await this.buildLlmConfig(userId);
    const startTime = Date.now();
    const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } =
      await this.llm.invoke(systemPrompt, userMessage, { ...llmConfig, promptName: 'INTEL_SYNTHESIS_SYSTEM_PROMPT' });
    const durationMs = Date.now() - startTime;

    let result: { executiveSummary: string; priorityActions: Array<{ rank: number; severity: string; source: string; title: string; detail: string }> };
    try {
      const cleaned = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      result = JSON.parse(cleaned) as typeof result;
    } catch {
      this.logger.error(`[IntelSynthesis] Failed to parse JSON: ${content.slice(0, 200)}`);
      throw new Error('AI returned malformed JSON for intel synthesis');
    }

    // AI interaction persisted centrally by LlmService.invoke (see llm.service.ts).
    return result;
  }

  // ── Project-scope Intel Report ───────────────────────────────────────────

  /**
   * Generate a project-scoped threat-intel markdown report from a pre-assembled
   * snapshot (project metadata + per-diagram threat summaries).
   *
   * Unlike `intelSynthesis` (which is diagram-scoped and uses specific DB IDs),
   * this method operates on caller-provided data and is intended for the persisted
   * multi-flow intel report feature (Task 3.3 + Task 7.1).
   */
  async generateIntelReport(snapshot: IntelSnapshot, userId?: string): Promise<string> {
    const diagramSummaries = snapshot.diagrams.map(d => {
      const counts = Object.entries(d.severityCounts).map(([k, v]) => `${k}:${v}`).join(', ');
      const top = d.topThreats.map(t => `- [${t.severity}/${t.stride}] ${t.title}`).join('\n');
      return `### ${d.name} (v${d.version})\nThreat counts: ${counts || 'none'}\n${top || '_no threats yet_'}`;
    }).join('\n\n');

    const formattedPrompt = await intelSynthesisPrompt.format({
      projectName: snapshot.project.name,
      projectDescription: snapshot.project.description ?? '',
      techStack: (snapshot.project.techStack ?? []).join(', '),
      environment: snapshot.project.environment ?? '',
      compliance: (snapshot.project.compliance ?? []).join(', '),
      notes: snapshot.project.notes ?? '',
      diagramSummaries,
    });

    const systemPrompt = 'You are a senior threat-intelligence analyst. Produce a structured markdown intel report.';
    const { content } = await this.llm.invoke(systemPrompt, formattedPrompt, { userId, promptName: 'intel-synthesis' });
    return content;
  }

  private async callAi(
    userId: string,
    originalPrompt: string,
    userMessage: string,
    diagramId?: string,
  ) {

    this.logger.debug(`Calling LLM with prompt: ${userMessage}`);
    const llmConfig = await this.buildLlmConfig(userId);
    const startTime = Date.now();

    try {
      const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } = await this.llm.invoke(SYSTEM_PROMPT, userMessage, { ...llmConfig, diagramId: diagramId ?? null, promptName: 'SYSTEM_PROMPT' });

      // Strip markdown fences if the model wrapped the JSON (Ollama sometimes does)
      const raw = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(raw);
      const durationMs = Date.now() - startTime;

      // AI interaction persisted centrally by LlmService.invoke (see llm.service.ts).
      return {
        data: parsed,
        usage: {
          tokensUsed,
          durationMs,
          model: `${llmProvider}/${llmModel}`,
        },
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new InternalServerErrorException('AI returned invalid JSON');
      }
      throw error;
    }
  }
}
