import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

export type LlmProvider = 'anthropic' | 'ollama';

export interface LlmResponse {
  content: string;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  provider: string;
  model: string;
}

export interface LlmCallConfig {
  provider?: string;
  model?: string;
  maxOutputTokens?: number;
  /** Ollama only: context window size in tokens. Defaults to OLLAMA_CONTEXT_MAP lookup or 32768. */
  numCtx?: number;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Ollama model → context window (num_ctx) map.
 *
 * Keep these values as SMALL as reasonable for each model — num_ctx is the single
 * biggest lever for inference speed on Ollama. A larger context pre-allocates more
 * KV-cache memory and dramatically slows every token generation step.
 * Only set 128K for models that genuinely need it (gpt-oss, llama3.3).
 */
const OLLAMA_CONTEXT_MAP: Record<string, number> = {
  'qwen3:1b':         4096,   // tiny — 4K is plenty
  'qwen3:4b':         8192,
  'qwen3:8b':         8192,   // 8K: ~3–4× faster than 32K on CPU
  'qwen3:14b':        16384,
  'qwen3:32b':        32768,
  'gpt-oss:20b':      131072,
  'gpt-oss:120b':     131072,
  'llama3.3:70b':     131072,
  'mistral:7b':        8192,
  'mistral:instruct':  8192,
};

/** Resolve num_ctx: explicit config → OLLAMA_NUM_CTX env → catalog → safe default (8192). */
function resolveNumCtx(
  model: string,
  explicitNumCtx?: number,
  envNumCtx?: number,
): number {
  if (explicitNumCtx) return explicitNumCtx;
  if (envNumCtx) return envNumCtx;
  // Exact match, then prefix match (handles quantized tags like "qwen3:8b-q4_K_M")
  if (OLLAMA_CONTEXT_MAP[model]) return OLLAMA_CONTEXT_MAP[model];
  const prefix = Object.keys(OLLAMA_CONTEXT_MAP).find((k) => model.startsWith(k));
  return prefix ? OLLAMA_CONTEXT_MAP[prefix] : 8192;
}

/**
 * qwen3 models have built-in chain-of-thought thinking that fires on every request
 * unless explicitly disabled. The thinking tokens are hidden from the output but
 * still consume compute — for complex prompts (AttackMind, PostureScore) this easily
 * adds 100 K+ internal tokens and pushes latency over 4 minutes on CPU.
 *
 * Injecting "/no_think" anywhere in the conversation disables this per Qwen3 spec.
 * We prepend it to the system prompt so every call site benefits automatically.
 */
function applyOllamaOptimizations(systemPrompt: string, provider: string, model: string): string {
  if (provider !== 'ollama') return systemPrompt;
  // Disable qwen3 thinking mode
  if (model.toLowerCase().startsWith('qwen3:')) {
    return `/no_think\n\n${systemPrompt}`;
  }
  return systemPrompt;
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
  private readonly llm: ChatAnthropic | ChatOllama | ChatOpenAI;
  /** Used for stream()/streamConversation() — no JSON constraint so markdown works */
  private readonly llmText: ChatAnthropic | ChatOllama | ChatOpenAI;
  /** Anthropic-only: used for invokeWithThinking() — extended thinking enabled */
  private readonly llmThinking: ChatAnthropic | null = null;

  readonly provider: LlmProvider;
  readonly modelName: string;

  constructor(private readonly config: ConfigService) {
    this.provider = (config.get<string>('AI_PROVIDER') ?? 'anthropic') as LlmProvider;

    if (this.provider === 'ollama') {
      this.modelName = config.get<string>('OLLAMA_MODEL') ?? 'qwen3:8b';
      const baseUrl = config.get<string>('OLLAMA_BASE_URL') ?? 'http://localhost:11434';
      const envNumCtx = config.get<number>('OLLAMA_NUM_CTX');
      const numCtx = resolveNumCtx(this.modelName, undefined, envNumCtx);

      this.llm = new ChatOllama({
        baseUrl,
        model: this.modelName,
        temperature: 0,
        numCtx,
        format: 'json',
      });

      this.llmText = new ChatOllama({
        baseUrl,
        model: this.modelName,
        temperature: 0,
        numCtx,
      });

      this.logger.log(`LLM provider: Ollama — ${this.modelName} @ ${baseUrl} (numCtx=${numCtx})`);
    } else {
      this.modelName = config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';
      const anthropicApiKey = config.get<string>('ANTHROPIC_API_KEY');

      if (anthropicApiKey) {
        this.llm = new ChatAnthropic({
          apiKey: anthropicApiKey,
          model: this.modelName,
          maxTokens: 4096,
          temperature: 0,
        });

        // Anthropic has no JSON-only constraint, same instance works for both
        this.llmText = this.llm;

        // Extended thinking instance: temperature must be 1 per Anthropic API spec
        this.llmThinking = new ChatAnthropic({
          apiKey: anthropicApiKey,
          model: this.modelName,
          // Extended thinking requires a higher token budget; maxTokens must be >= budget_tokens
          maxTokens: 16000,
          temperature: 1,
          thinking: { type: 'enabled', budget_tokens: 10000 },
        });
      } else {
        // No env key — API key will be supplied per-call from the DB via LlmCallConfig.apiKey
        this.llm = null as unknown as ChatAnthropic;
        this.llmText = null as unknown as ChatAnthropic;
      }

      this.logger.log(`LLM provider: Anthropic — ${this.modelName}${anthropicApiKey ? '' : ' (key supplied per-call)'}`);
    }
  }

  private resolveLlm(config?: LlmCallConfig): {
    llm: ChatAnthropic | ChatOllama | ChatOpenAI;
    llmText: ChatAnthropic | ChatOllama | ChatOpenAI;
    resolvedProvider: string;
    resolvedModel: string;
  } {
    const hasCustom = config && (config.model || config.apiKey || config.baseUrl || config.provider || config.maxOutputTokens);
    if (!hasCustom) {
      return { llm: this.llm, llmText: this.llmText, resolvedProvider: this.provider, resolvedModel: this.modelName };
    }
    const effectiveProvider = config.provider ?? this.provider;

    if (effectiveProvider === 'ollama') {
      const model = config.model ?? this.modelName;
      const baseUrl = config.baseUrl ?? this.config.get<string>('OLLAMA_BASE_URL') ?? 'http://localhost:11434';
      const envNumCtx = this.config.get<number>('OLLAMA_NUM_CTX');
      const numCtx = resolveNumCtx(model, config.numCtx, envNumCtx);
      this.logger.debug(`Ollama resolveLlm — model=${model} baseUrl=${baseUrl} numCtx=${numCtx}`);
      const llm = new ChatOllama({ baseUrl, model, temperature: 0, numCtx, format: 'json' });
      const llmText = new ChatOllama({ baseUrl, model, temperature: 0, numCtx });
      return { llm, llmText, resolvedProvider: 'ollama', resolvedModel: model };
    }

    if (effectiveProvider === 'openai') {
      const model = config.model ?? 'gpt-4o';
      const apiKey = config.apiKey ?? this.config.get<string>('OPENAI_API_KEY');
      const maxTokens = config.maxOutputTokens ?? 4096;
      const baseURL = config.baseUrl ?? this.config.get<string>('OPENAI_BASE_URL') ?? undefined;
      const llm = new ChatOpenAI({ apiKey, model, maxTokens, temperature: 0, ...(baseURL && { configuration: { baseURL } }) });
      return { llm, llmText: llm, resolvedProvider: 'openai', resolvedModel: model };
    }

    // anthropic (default + replicate fallback)
    const model = config.model ?? this.modelName;
    const apiKey = config.apiKey ?? this.config.get<string>('ANTHROPIC_API_KEY');
    const maxTokens = config.maxOutputTokens ?? 4096;
    const llm = new ChatAnthropic({ apiKey, model, maxTokens, temperature: 0 });
    return { llm, llmText: llm, resolvedProvider: 'anthropic', resolvedModel: model };
  }

  /**
   * Send a system + user message pair using Claude extended thinking.
   * Falls back to regular invoke() for Ollama (no extended thinking support).
   * budgetTokens controls how much the model is allowed to "think" before responding.
   */
  async invokeWithThinking(systemPrompt: string, userMessage: string, config?: LlmCallConfig): Promise<LlmResponse> {
    const effectiveProvider = config?.provider ?? this.provider;
    if (effectiveProvider !== 'anthropic') {
      this.logger.warn(`Extended thinking requested but effective provider is '${effectiveProvider}' — falling back to standard invoke`);
      return this.invoke(systemPrompt, userMessage, config);
    }

    // Build a per-request thinking instance when the user has a custom key/model, else use the singleton
    let thinkingLlm: ChatAnthropic;
    if (config?.model || config?.apiKey) {
      const model = config.model ?? this.modelName;
      const apiKey = config.apiKey ?? this.config.get<string>('ANTHROPIC_API_KEY');
      const maxTokens = Math.max(config.maxOutputTokens ?? 0, 16000);
      thinkingLlm = new ChatAnthropic({ apiKey, model, maxTokens, temperature: 1, thinking: { type: 'enabled', budget_tokens: 10000 } });
    } else if (this.llmThinking) {
      thinkingLlm = this.llmThinking;
    } else {
      this.logger.warn('No thinking-capable Anthropic instance available — falling back to standard invoke');
      return this.invoke(systemPrompt, userMessage, config);
    }

    const resolvedModel = config?.model ?? this.modelName;
    this.logger.debug(`invokeWithThinking — ${resolvedModel}`);

    const response = await thinkingLlm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ]);

    const content = this.extractText(response.content);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = (response as any).usage_metadata as { total_tokens?: number; input_tokens?: number; output_tokens?: number } | undefined;
    const tokensUsed = usage?.total_tokens ?? 0;
    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;

    this.logger.debug(`invokeWithThinking tokens used: ${tokensUsed}`);
    return { content, tokensUsed, inputTokens, outputTokens, provider: 'anthropic', model: resolvedModel };
  }

  /**
   * Send a system + user message pair to the configured LLM and return the
   * text content along with the total token count (0 when unavailable).
   */
  async invoke(systemPrompt: string, userMessage: string, config?: LlmCallConfig): Promise<LlmResponse> {
    const { llm, resolvedProvider, resolvedModel } = this.resolveLlm(config);
    const effectiveSystemPrompt = applyOllamaOptimizations(systemPrompt, resolvedProvider, resolvedModel);

    this.logger.debug(`system-prompt ${resolvedModel} — ${effectiveSystemPrompt}`);
    this.logger.debug(`user-message — ${userMessage}`);

    let response: Awaited<ReturnType<typeof llm.invoke>>;
    try {
      response = await llm.invoke([
        new SystemMessage(effectiveSystemPrompt),
        new HumanMessage(userMessage),
      ]);
    } catch (err) {
      this.rethrowConnectionError(err, resolvedProvider, resolvedModel);
    }

    const content = this.extractText(response.content);

    // usage_metadata is populated by LangChain for both Anthropic and Ollama
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = (response as any).usage_metadata as
      | { total_tokens?: number; input_tokens?: number; output_tokens?: number }
      | undefined;
    const tokensUsed = usage?.total_tokens ?? 0;
    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;

    this.logger.debug(`LLM response content: ${content}`);
    this.logger.debug(`LLM tokens used: ${tokensUsed}`);
    this.logger.debug(`LLM used model: ${resolvedModel}`);
    this.logger.debug(`LLM provider: ${resolvedProvider}`);

    return { content, tokensUsed, inputTokens, outputTokens, provider: resolvedProvider, model: resolvedModel };
  }

  /**
   * Stream a system + user message pair, yielding text chunks as they arrive.
   * Uses llmText (no JSON constraint) so responses are markdown/plain text.
   */
  async *stream(systemPrompt: string, userMessage: string, config?: LlmCallConfig): AsyncGenerator<string> {
    const { llmText, resolvedProvider, resolvedModel } = this.resolveLlm(config);
    const effectiveSystemPrompt = applyOllamaOptimizations(systemPrompt, resolvedProvider, resolvedModel);
    try {
      const chunks = await llmText.stream([
        new SystemMessage(effectiveSystemPrompt),
        new HumanMessage(userMessage),
      ]);
      for await (const chunk of chunks) {
        const text = this.extractText(chunk.content);
        if (text) yield text;
      }
    } catch (err) {
      this.rethrowConnectionError(err, resolvedProvider, resolvedModel);
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
    config?: LlmCallConfig,
  ): AsyncGenerator<string> {
    const { llmText, resolvedProvider, resolvedModel } = this.resolveLlm(config);
    const effectiveSystemPrompt = applyOllamaOptimizations(systemPrompt, resolvedProvider, resolvedModel);
    const msgs = [
      new SystemMessage(effectiveSystemPrompt),
      ...history.map((m) =>
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
      ),
      new HumanMessage(userMessage),
    ];
    const chunks = await llmText.stream(msgs);
    for await (const chunk of chunks) {
      const text = this.extractText(chunk.content);
      if (text) yield text;
    }
  }

  /**
   * If the error is a low-level network/fetch failure (Ollama not reachable),
   * throw a descriptive ServiceUnavailableException instead of a generic 500.
   */
  private rethrowConnectionError(err: unknown, provider: string, model: string): never {
    const msg = err instanceof Error ? err.message : String(err);
    const isFetchError = msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND');
    if (isFetchError && provider === 'ollama') {
      const baseUrl = this.config.get<string>('OLLAMA_BASE_URL') ?? 'http://localhost:11434';
      throw new ServiceUnavailableException(
        `Ollama is not reachable at ${baseUrl}. ` +
        `Make sure Ollama is running ("ollama serve") and the model is pulled ("ollama pull ${model}"). ` +
        `If running in Docker, use http://host.docker.internal:11434 as the base URL.`,
      );
    }
    throw err as Error;
  }

  private extractText(content: unknown): string {
    if (typeof content === 'string') return content;
    return (content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
  }
}
