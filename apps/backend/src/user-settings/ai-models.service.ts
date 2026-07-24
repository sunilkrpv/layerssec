import { Injectable, Logger } from '@nestjs/common';
import { AiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserSettingsService } from './user-settings.service';
import { validateSafeHttpsUrl } from '../common/url-safety';

export type ReasoningLevel = 'fast' | 'balanced' | 'powerful' | 'reasoning';

export interface AiModelInfo {
  id: string;
  label: string;
  contextWindow: string;
  reasoning: ReasoningLevel;
  description: string;
  badge?: string;
}

export interface AiModelsResponse {
  /** 'live' = fetched from the provider; 'none' = no key / unsupported / fetch failed → use the frontend fallback catalog. */
  source: 'live' | 'none';
  models: AiModelInfo[];
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — model lists change rarely
const FETCH_TIMEOUT_MS = 8000;

/** Static enrichment for OpenAI IDs (the list endpoint returns no context/reasoning metadata). */
const OPENAI_ENRICH: { match: RegExp; contextWindow: string; reasoning: ReasoningLevel }[] = [
  { match: /^o[13]($|-)/, contextWindow: '200K', reasoning: 'reasoning' },
  { match: /^o4-mini/, contextWindow: '200K', reasoning: 'reasoning' },
  { match: /^gpt-4o-mini/, contextWindow: '128K', reasoning: 'fast' },
  { match: /^gpt-4o/, contextWindow: '128K', reasoning: 'balanced' },
  { match: /^gpt-4/, contextWindow: '128K', reasoning: 'balanced' },
  { match: /^gpt-3\.5/, contextWindow: '16K', reasoning: 'fast' },
];

/** OpenAI list is noisy — drop non-chat models. */
const OPENAI_EXCLUDE =
  /(embedding|whisper|tts|dall-e|audio|realtime|transcribe|image|moderation|search|davinci|babbage|codex|instruct)/i;

@Injectable()
export class AiModelsService {
  private readonly logger = new Logger(AiModelsService.name);
  private readonly cache = new Map<string, { expires: number; data: AiModelsResponse }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly userSettings: UserSettingsService,
  ) {}

  async listModels(userId: string, provider: AiProvider): Promise<AiModelsResponse> {
    const cacheKey = `${userId}:${provider}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    let data: AiModelsResponse;
    try {
      data = await this.fetchFromProvider(userId, provider);
    } catch (err) {
      this.logger.warn(`Model list fetch failed for ${provider}: ${(err as Error).message}`);
      data = { source: 'none', models: [] };
    }

    // Only cache successful live results; let 'none' retry on next open.
    if (data.source === 'live') {
      this.cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, data });
    }
    return data;
  }

  private async fetchFromProvider(userId: string, provider: AiProvider): Promise<AiModelsResponse> {
    switch (provider) {
      case AiProvider.ANTHROPIC:
        return this.fetchAnthropic(userId);
      case AiProvider.OPENAI:
        return this.fetchOpenAi(userId);
      case AiProvider.OLLAMA:
        return this.fetchOllama(userId);
      default:
        return { source: 'none', models: [] };
    }
  }

  // ── Anthropic ──────────────────────────────────────────────────────────────

  private async fetchAnthropic(userId: string): Promise<AiModelsResponse> {
    const key = await this.userSettings.getDecryptedApiKey(userId, 'anthropic');
    if (!key) return { source: 'none', models: [] };

    const raw = await this.httpJson('https://api.anthropic.com/v1/models?limit=100', {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    });

    const rows: any[] = Array.isArray(raw?.data) ? raw.data : [];
    const models: AiModelInfo[] = rows
      .filter((m) => typeof m?.id === 'string' && m.id.startsWith('claude-'))
      .map((m) => {
        const id: string = m.id;
        const reasoning = this.anthropicReasoning(id);
        return {
          id,
          label: typeof m.display_name === 'string' ? m.display_name : id,
          contextWindow: this.tokensToLabel(m.max_input_tokens) ?? '200K',
          reasoning,
          description: `${m.display_name ?? id} — ${this.reasoningBlurb(reasoning)}`,
        } satisfies AiModelInfo;
      });

    if (models.length === 0) return { source: 'none', models: [] };
    this.markRecommended(models, (m) => m.reasoning === 'balanced');
    return { source: 'live', models };
  }

  private anthropicReasoning(id: string): ReasoningLevel {
    if (/opus|fable|mythos/.test(id)) return 'powerful';
    if (/haiku/.test(id)) return 'fast';
    return 'balanced'; // sonnet + unknown
  }

  // ── OpenAI ─────────────────────────────────────────────────────────────────

  private async fetchOpenAi(userId: string): Promise<AiModelsResponse> {
    const key = await this.userSettings.getDecryptedApiKey(userId, 'openai');
    if (!key) return { source: 'none', models: [] };

    const base = await this.resolveOpenAiBase(userId);
    const raw = await this.httpJson(`${base}/v1/models`, { Authorization: `Bearer ${key}` });

    const rows: any[] = Array.isArray(raw?.data) ? raw.data : [];
    const models: AiModelInfo[] = rows
      .map((m) => (typeof m?.id === 'string' ? m.id : null))
      .filter((id): id is string => !!id && /^(gpt-|o\d)/.test(id) && !OPENAI_EXCLUDE.test(id))
      .map((id) => {
        const enrich = OPENAI_ENRICH.find((e) => e.match.test(id));
        const reasoning = enrich?.reasoning ?? 'balanced';
        return {
          id,
          label: id,
          contextWindow: enrich?.contextWindow ?? '128K',
          reasoning,
          description: this.reasoningBlurb(reasoning),
        } satisfies AiModelInfo;
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    if (models.length === 0) return { source: 'none', models: [] };
    this.markRecommended(models, (m) => m.id === 'gpt-4o');
    return { source: 'live', models };
  }

  private async resolveOpenAiBase(userId: string): Promise<string> {
    const row = await this.prisma.userAiSettings.findUnique({
      where: { userId },
      select: { openAiBaseUrl: true },
    });
    const custom = row?.openAiBaseUrl;
    if (!custom) return 'https://api.openai.com';
    // Re-validate at use-time — never trust a stored SSRF-relevant value blindly.
    const result = validateSafeHttpsUrl(custom);
    if (result.ok === false) {
      this.logger.warn(`Stored openAiBaseUrl failed re-validation: ${result.reason}`);
      return 'https://api.openai.com';
    }
    return result.normalized.replace(/\/+$/, '').replace(/\/v1$/, '');
  }

  // ── Ollama (genuinely dynamic — lists locally pulled models) ─────────────────

  private async fetchOllama(userId: string): Promise<AiModelsResponse> {
    const row = await this.prisma.userAiSettings.findUnique({
      where: { userId },
      select: { ollamaBaseUrl: true },
    });
    const base = (row?.ollamaBaseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    const raw = await this.httpJson(`${base}/api/tags`, {});

    const rows: any[] = Array.isArray(raw?.models) ? raw.models : [];
    const models: AiModelInfo[] = rows
      .map((m) => (typeof m?.name === 'string' ? m.name : null))
      .filter((n): n is string => !!n)
      .map((name) => ({
        id: name,
        label: name,
        contextWindow: '—',
        reasoning: 'balanced' as ReasoningLevel,
        description: 'Local model pulled on this Ollama host.',
      }));

    if (models.length === 0) return { source: 'none', models: [] };
    return { source: 'live', models };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async httpJson(url: string, headers: Record<string, string>): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  private tokensToLabel(tokens: unknown): string | null {
    if (typeof tokens !== 'number' || tokens <= 0) return null;
    if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M`;
    return `${Math.round(tokens / 1000)}K`;
  }

  private reasoningBlurb(level: ReasoningLevel): string {
    switch (level) {
      case 'fast':
        return 'Fast and compact. Good for quick edits and simple tasks.';
      case 'powerful':
        return 'Most capable. Best for complex architecture and threat analysis.';
      case 'reasoning':
        return 'Reasoning model. Strong for security analysis and threat modeling.';
      default:
        return 'Balanced speed and intelligence. Recommended for most workflows.';
    }
  }

  private markRecommended(models: AiModelInfo[], pick: (m: AiModelInfo) => boolean): void {
    const match = models.find(pick) ?? models[0];
    if (match) match.badge = 'Recommended';
  }
}
