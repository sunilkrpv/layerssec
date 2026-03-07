import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from './llm.service';
import { SYSTEM_PROMPT } from './prompts/system-prompt';
import { buildGeneratePrompt } from './prompts/generate-prompt';
import { buildSuggestPrompt } from './prompts/suggest-prompt';
import { buildRefinePrompt } from './prompts/refine-prompt';
import { DRAFTER_SYSTEM_PROMPT } from './prompts/drafter-system-prompt';
import { EVAL_SYSTEM_PROMPT, QA_SYSTEM_PROMPT } from './prompts/eval-system-prompt';
import { CHAT_SYSTEM_PROMPT, buildLayerContextSystemPrompt } from './prompts/chat-system-prompt';
import { buildContextualSystemPrompt } from './prompts/contextual-system-prompt';
import { ChatService } from '../chat/chat.service';
import { RagContextService } from '../rag/rag-context.service';
import { RagIndexingService } from '../rag/rag-indexing.service';
import { ChatGenerateDto } from './dto/chat-generate.dto';
import { ChatEvaluateDto } from './dto/chat-evaluate.dto';
import { ChatAskDto } from './dto/chat-ask.dto';
import { ContextualAskDto } from './dto/contextual-ask.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly ragContext: RagContextService,
    private readonly ragIndexing: RagIndexingService,
  ) {}

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
    const userMessage = `Generate a diagram for: ${dto.prompt}`;
    const { content } = await this.llm.invoke(DRAFTER_SYSTEM_PROMPT, userMessage);
    const raw = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const diagram = JSON.parse(raw) as { nodes: unknown[]; edges: unknown[] };
    if (!Array.isArray(diagram.nodes) || !Array.isArray(diagram.edges)) {
      throw new InternalServerErrorException('AI returned invalid diagram structure');
    }
    if (dto.projectId) {
      const nodeCount = diagram.nodes.length;
      const edgeCount = diagram.edges.length;
      await this.chat.saveMessages(dto.projectId, userId, [
        { role: 'user', content: dto.prompt, layerId: dto.layerId, layerName: dto.layerName },
        {
          role: 'assistant',
          content: `Generated diagram with ${nodeCount} node${nodeCount !== 1 ? 's' : ''} and ${edgeCount} edge${edgeCount !== 1 ? 's' : ''}.`,
          layerId: dto.layerId,
          layerName: dto.layerName,
        },
      ]);
    }
    return diagram;
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

    let fullResponse = '';
    try {
      for await (const chunk of this.llm.stream(systemPrompt, userContent)) {
        res.write(chunk);
        fullResponse += chunk;
      }
    } finally {
      if (dto.projectId && fullResponse) {
        await this.chat.saveMessages(dto.projectId, userId, [
          { role: 'user', content: userMessageLabel, layerId: dto.layerId, layerName: dto.layerName },
          { role: 'assistant', content: fullResponse, layerId: dto.layerId, layerName: dto.layerName },
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

    let fullResponse = '';
    try {
      for await (const chunk of this.llm.streamConversation(
        systemPrompt,
        dto.history ?? [],
        dto.message,
      )) {
        res.write(chunk);
        fullResponse += chunk;
      }
    } finally {
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

    let fullResponse = '';
    try {
      for await (const chunk of this.llm.streamConversation(
        systemPrompt,
        dto.history ?? [],
        dto.message,
      )) {
        res.write(chunk);
        fullResponse += chunk;
      }
    } finally {
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
          { role: 'assistant' as const, content: textContent, diagramData: diagramData ?? undefined },
        ];
        await Promise.all([
          this.chat.saveMessages(dto.projectId, userId, messages),
          this.ragIndexing.indexChatMessages(dto.projectId, userId, messages),
        ]);
      }
      res.end();
    }
  }

  private async callAi(
    userId: string,
    originalPrompt: string,
    userMessage: string,
    diagramId?: string,
  ) {
    const startTime = Date.now();

    try {
      const { content, tokensUsed } = await this.llm.invoke(SYSTEM_PROMPT, userMessage);

      // Strip markdown fences if the model wrapped the JSON (Ollama sometimes does)
      const raw = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(raw);
      const durationMs = Date.now() - startTime;
      const modelLabel = `${this.llm.provider}/${this.llm.modelName}`;

      await this.prisma.aiInteraction.create({
        data: {
          userId,
          diagramId,
          prompt: originalPrompt,
          response: parsed,
          tokensUsed,
          model: modelLabel,
          durationMs,
        },
      });

      return {
        data: parsed,
        usage: {
          tokensUsed,
          durationMs,
          model: modelLabel,
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
