import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';
import { validateSafeHttpsUrl } from '../common/url-safety';
import { AiProvider } from '@prisma/client';

export interface AiSettingsResponse {
  provider: AiProvider;
  model: string;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  ollamaBaseUrl: string | null;
  openAiBaseUrl: string | null;
  /** True when an Anthropic API key is stored (never returns the plaintext key). */
  anthropicKeySet: boolean;
  /** Masked preview of the Anthropic key, e.g. "sk-ant-api03-••••••••" */
  anthropicKeyMasked: string | null;
  /** True when an OpenAI API key is stored. */
  openAiKeySet: boolean;
  /** Masked preview of the OpenAI key. */
  openAiKeyMasked: string | null;
}

@Injectable()
export class UserSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // ── Public API (returns masked settings — never plaintext keys) ─────────────

  async getAiSettings(userId: string): Promise<AiSettingsResponse> {
    const row = await this.prisma.userAiSettings.findUnique({ where: { userId } });
    return this.toResponse(row);
  }

  async updateAiSettings(userId: string, dto: UpdateAiSettingsDto): Promise<AiSettingsResponse> {
    // Defense-in-depth: re-validate openAiBaseUrl even though the DTO decorator
    // already guards it. Never trust a single layer for SSRF-relevant fields.
    let normalizedOpenAiBaseUrl: string | null | undefined;
    if (dto.openAiBaseUrl !== undefined) {
      if (!dto.openAiBaseUrl) {
        normalizedOpenAiBaseUrl = null;
      } else {
        const result = validateSafeHttpsUrl(dto.openAiBaseUrl);
        if (result.ok === false) throw new BadRequestException(result.reason);
        normalizedOpenAiBaseUrl = result.normalized;
      }
    }

    // Build the update payload — only include fields that were actually sent
    const updateData: Record<string, unknown> = {};
    if (dto.provider !== undefined) updateData.provider = dto.provider as AiProvider;
    if (dto.model !== undefined) updateData.model = dto.model;
    if (dto.maxOutputTokens !== undefined) updateData.maxOutputTokens = dto.maxOutputTokens;
    if (dto.ollamaBaseUrl !== undefined) updateData.ollamaBaseUrl = dto.ollamaBaseUrl || null;
    if (normalizedOpenAiBaseUrl !== undefined) updateData.openAiBaseUrl = normalizedOpenAiBaseUrl;

    // API keys — encrypt non-empty values, null to clear
    if (dto.anthropicApiKey !== undefined) {
      updateData.encryptedAnthropicKey = dto.anthropicApiKey
        ? this.encryption.encrypt(dto.anthropicApiKey)
        : null;
    }
    if (dto.openAiApiKey !== undefined) {
      updateData.encryptedOpenAiKey = dto.openAiApiKey
        ? this.encryption.encrypt(dto.openAiApiKey)
        : null;
    }

    const row = await this.prisma.userAiSettings.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        provider: (dto.provider as AiProvider | undefined) ?? AiProvider.ANTHROPIC,
        model: dto.model ?? 'claude-sonnet-4-6',
        maxOutputTokens: dto.maxOutputTokens ?? null,
        ollamaBaseUrl: dto.ollamaBaseUrl || null,
        openAiBaseUrl: normalizedOpenAiBaseUrl ?? null,
        encryptedAnthropicKey: dto.anthropicApiKey
          ? this.encryption.encrypt(dto.anthropicApiKey)
          : null,
        encryptedOpenAiKey: dto.openAiApiKey
          ? this.encryption.encrypt(dto.openAiApiKey)
          : null,
      },
    });

    return this.toResponse(row);
  }

  // ── Internal-only: returns decrypted API key for LLM calls ──────────────────

  async getDecryptedApiKey(
    userId: string,
    provider: 'anthropic' | 'openai',
  ): Promise<string | null> {
    const row = await this.prisma.userAiSettings.findUnique({
      where: { userId },
      select: {
        encryptedAnthropicKey: true,
        encryptedOpenAiKey: true,
      },
    });
    if (!row) return null;

    const encrypted =
      provider === 'anthropic'
        ? row.encryptedAnthropicKey
        : row.encryptedOpenAiKey;

    if (!encrypted) return null;

    try {
      return this.encryption.decrypt(encrypted);
    } catch {
      // Key tampered or ENCRYPTION_KEY changed — treat as absent
      return null;
    }
  }

  // ── Token metrics ────────────────────────────────────────────────────────────

  async getTokenMetrics(userId: string) {
    const interactions = await this.prisma.aiInteraction.findMany({
      where: { userId },
      select: { model: true, tokensUsed: true, inputTokens: true, outputTokens: true, createdAt: true },
    });

    const byModel: Record<
      string,
      { provider: string; model: string; inputTokens: number; outputTokens: number; calls: number }
    > = {};
    let totalInput = 0;
    let totalOutput = 0;

    for (const row of interactions) {
      // model is stored as "provider/modelName"
      const slashIdx = row.model.indexOf('/');
      const provider = slashIdx !== -1 ? row.model.slice(0, slashIdx) : 'unknown';
      const modelName = slashIdx !== -1 ? row.model.slice(slashIdx + 1) : row.model;

      const input = row.inputTokens ?? 0;
      const output = row.outputTokens ?? row.tokensUsed - (row.inputTokens ?? 0);

      if (!byModel[row.model]) {
        byModel[row.model] = { provider, model: modelName, inputTokens: 0, outputTokens: 0, calls: 0 };
      }
      byModel[row.model].inputTokens += input;
      byModel[row.model].outputTokens += output;
      byModel[row.model].calls += 1;
      totalInput += input;
      totalOutput += output;
    }

    return {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalTokens: totalInput + totalOutput,
      byModel: Object.values(byModel).sort(
        (a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
      ),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private toResponse(
    row: {
      provider: AiProvider;
      model: string;
      maxInputTokens: number | null;
      maxOutputTokens: number | null;
      ollamaBaseUrl: string | null;
      openAiBaseUrl: string | null;
      encryptedAnthropicKey?: string | null;
      encryptedOpenAiKey?: string | null;
    } | null,
  ): AiSettingsResponse {
    if (!row) {
      return {
        provider: AiProvider.ANTHROPIC,
        model: 'claude-sonnet-4-6',
        maxInputTokens: null,
        maxOutputTokens: null,
        ollamaBaseUrl: null,
        openAiBaseUrl: null,
        anthropicKeySet: false,
        anthropicKeyMasked: null,
        openAiKeySet: false,
        openAiKeyMasked: null,
      };
    }

    const anthropicKeySet = !!row.encryptedAnthropicKey;
    const openAiKeySet = !!row.encryptedOpenAiKey;

    return {
      provider: row.provider,
      model: row.model,
      maxInputTokens: row.maxInputTokens,
      maxOutputTokens: row.maxOutputTokens,
      ollamaBaseUrl: row.ollamaBaseUrl,
      openAiBaseUrl: row.openAiBaseUrl,
      anthropicKeySet,
      anthropicKeyMasked: anthropicKeySet
        ? this.safeMask(row.encryptedAnthropicKey!)
        : null,
      openAiKeySet,
      openAiKeyMasked: openAiKeySet
        ? this.safeMask(row.encryptedOpenAiKey!)
        : null,
    };
  }

  /** Decrypt just enough to produce a masked display value. Falls back to a generic mask on error. */
  private safeMask(encrypted: string): string {
    try {
      return this.encryption.maskApiKey(this.encryption.decrypt(encrypted));
    } catch {
      return '••••••••••••';
    }
  }
}
