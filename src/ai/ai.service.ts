import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from './llm.service';
import { SYSTEM_PROMPT } from './prompts/system-prompt';
import { buildGeneratePrompt } from './prompts/generate-prompt';
import { buildSuggestPrompt } from './prompts/suggest-prompt';
import { buildRefinePrompt } from './prompts/refine-prompt';

@Injectable()
export class AiService {
  constructor(
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
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
