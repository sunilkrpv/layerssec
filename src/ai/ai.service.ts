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
import { CHAT_SYSTEM_PROMPT } from './prompts/chat-system-prompt';
import { ChatService } from '../chat/chat.service';
import { ChatGenerateDto } from './dto/chat-generate.dto';
import { ChatEvaluateDto } from './dto/chat-evaluate.dto';
import { ChatAskDto } from './dto/chat-ask.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
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

    let fullResponse = '';
    try {
      for await (const chunk of this.llm.streamConversation(
        CHAT_SYSTEM_PROMPT,
        dto.history ?? [],
        dto.message,
      )) {
        res.write(chunk);
        fullResponse += chunk;
      }
    } finally {
      if (dto.projectId && fullResponse) {
        await this.chat.saveMessages(dto.projectId, userId, [
          { role: 'user', content: dto.message },
          { role: 'assistant', content: fullResponse },
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
