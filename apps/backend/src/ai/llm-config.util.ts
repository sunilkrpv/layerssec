import { UserSettingsService } from '../user-settings/user-settings.service';
import { LlmCallConfig } from './llm.service';

/**
 * Build a per-user LlmCallConfig from stored AI settings (provider, model,
 * server-side-decrypted key). Shared by every AI feature so the resolved
 * provider/key is identical regardless of which service issues the call —
 * without this, a caller that forgets to supply config falls back to the
 * env-only client, which is null when the key lives per-user in the DB.
 */
export async function buildLlmConfigForUser(
  userSettingsService: UserSettingsService,
  userId: string,
): Promise<LlmCallConfig> {
  const settings = await userSettingsService.getAiSettings(userId);
  const providerLower = settings.provider?.toLowerCase() as
    | 'anthropic'
    | 'openai'
    | 'ollama'
    | undefined;

  // Fetch decrypted API key server-side — never touches the HTTP response.
  let apiKey: string | undefined;
  if (providerLower === 'anthropic' || providerLower === 'openai') {
    const decrypted = await userSettingsService.getDecryptedApiKey(userId, providerLower);
    apiKey = decrypted ?? undefined;
  }

  return {
    // Stamp the owning user so LlmService can persist every call to ai_interactions.
    // Any call site that spreads this config inherits logging for free.
    userId,
    provider: providerLower,
    model: settings.model ?? undefined,
    maxOutputTokens: settings.maxOutputTokens ?? undefined,
    baseUrl: settings.ollamaBaseUrl ?? undefined,
    apiKey,
  };
}
