import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

export type LlmProvider = 'anthropic' | 'ollama';

export interface LlmResponse {
  content: string;
  tokensUsed: number;
}

/**
 * LlmService — LangChain-based LLM orchestrator.
 *
 * Provider is selected via the AI_PROVIDER env var ('anthropic' | 'ollama').
 * Defaults to 'anthropic' when the var is absent.
 *
 * Anthropic env vars:  ANTHROPIC_API_KEY, ANTHROPIC_MODEL (default: claude-sonnet-4-6)
 * Ollama env vars:     OLLAMA_BASE_URL (default: http://localhost:11434),
 *                      OLLAMA_MODEL (default: qwen2.5:7b)
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  /** Used for invoke() — JSON-constrained for diagram generation */
  private readonly llm: ChatAnthropic | ChatOllama;
  /** Used for stream()/streamConversation() — no JSON constraint so markdown works */
  private readonly llmText: ChatAnthropic | ChatOllama;

  readonly provider: LlmProvider;
  readonly modelName: string;

  constructor(private readonly config: ConfigService) {
    this.provider = (config.get<string>('AI_PROVIDER') ?? 'anthropic') as LlmProvider;

    if (this.provider === 'ollama') {
      this.modelName = config.get<string>('OLLAMA_MODEL') ?? 'qwen3:8b';
      const baseUrl = config.get<string>('OLLAMA_BASE_URL') ?? 'http://localhost:11434';

      this.llm = new ChatOllama({
        baseUrl,
        model: this.modelName,
        temperature: 0,
        format: 'json', // JSON-constrained for diagram generation
      });

      this.llmText = new ChatOllama({
        baseUrl,
        model: this.modelName,
        temperature: 0,
        // No format constraint — allows markdown/plain text responses
      });

      this.logger.log(`LLM provider: Ollama — ${this.modelName} @ ${baseUrl}`);
    } else {
      this.modelName = config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';

      this.llm = new ChatAnthropic({
        apiKey: config.get<string>('ANTHROPIC_API_KEY'),
        model: this.modelName,
        maxTokens: 4096,
        temperature: 0,
      });

      // Anthropic has no JSON-only constraint, same instance works for both
      this.llmText = this.llm;

      this.logger.log(`LLM provider: Anthropic — ${this.modelName}`);
    }
  }

  /**
   * Send a system + user message pair to the configured LLM and return the
   * text content along with the total token count (0 when unavailable).
   */
  async invoke(systemPrompt: string, userMessage: string): Promise<LlmResponse> {
    const response = await this.llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ]);

    const content = this.extractText(response.content);

    // usage_metadata is populated by LangChain for both Anthropic and Ollama
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = (response as any).usage_metadata as
      | { total_tokens?: number }
      | undefined;
    const tokensUsed = usage?.total_tokens ?? 0;

  //   const content = {
  //     "nodes": [{
  //     "id": "client",
  //     "type": "client",
  //     "position": { "x": 60, "y": 280 },
  //     "data": {
  //       "label": "Web Client",
  //       "description": "User interface for requesting and previewing presentations",
  //       "technology": "React"
  //     }
  //   }
  // ]}.toString();
  // const tokensUsed = 42; // Placeholder token count

    console.log('LLM response content:', content);
    console.log('LLM tokens used:', tokensUsed);
    console.log('LLM used model:', this.modelName);
    console.log('LLM provider:', this.provider);

    return { content, tokensUsed };
  }

  /**
   * Stream a system + user message pair, yielding text chunks as they arrive.
   * Uses llmText (no JSON constraint) so responses are markdown/plain text.
   */
  async *stream(systemPrompt: string, userMessage: string): AsyncGenerator<string> {
    const chunks = await this.llmText.stream([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ]);
    for await (const chunk of chunks) {
      const text = this.extractText(chunk.content);
      if (text) yield text;
    }
  }

  /**
   * Multi-turn conversational stream with history context.
   * Uses llmText so responses are markdown/plain text.
   */
  async *streamConversation(
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
  ): AsyncGenerator<string> {
    const msgs = [
      new SystemMessage(systemPrompt),
      ...history.map((m) =>
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
      ),
      new HumanMessage(userMessage),
    ];
    const chunks = await this.llmText.stream(msgs);
    for await (const chunk of chunks) {
      const text = this.extractText(chunk.content);
      if (text) yield text;
    }
  }

  private extractText(content: unknown): string {
    if (typeof content === 'string') return content;
    return (content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
  }
}
