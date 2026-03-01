import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

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
  private readonly llm: ChatAnthropic | ChatOllama;

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
        format: 'json', // Ask Ollama to constrain output to JSON
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

    // Normalise content — both providers can return string or array
    const content =
      typeof response.content === 'string'
        ? response.content
        : (response.content as Array<{ type: string; text?: string }>)
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('');

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
}
