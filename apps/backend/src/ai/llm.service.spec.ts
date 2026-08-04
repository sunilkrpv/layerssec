import { Logger } from '@nestjs/common';
import { LlmService, LlmCallConfig } from './llm.service';

/**
 * Focused tests for the centralized ai_interactions persistence that LlmService
 * performs on every call. The LLM transport itself needs a network and is not
 * exercised here — persistInteraction holds the new logic (user gating + row shape).
 */
describe('LlmService — centralized AI interaction logging', () => {
  let service: LlmService;
  let prisma: { aiInteraction: { create: jest.Mock } };
  let errorSpy: jest.SpyInstance;

  const config = { get: jest.fn().mockReturnValue(undefined) };

  const result = {
    content: 'the full model response text',
    tokensUsed: 42,
    inputTokens: 30,
    outputTokens: 12,
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
  };

  // persistInteraction is private; reach it directly to test the row it writes.
  const persist = (cfg: LlmCallConfig | undefined) =>
    (service as unknown as {
      persistInteraction: (
        c: LlmCallConfig | undefined,
        userMessage: string,
        r: typeof result,
        durationMs: number,
      ) => Promise<void>;
    }).persistInteraction(cfg, 'the full user prompt', result, 1234);

  beforeEach(() => {
    prisma = { aiInteraction: { create: jest.fn().mockResolvedValue({ id: 'ai_1' }) } };
    // provider defaults to anthropic with no key → null transport client, no network in ctor.
    service = new LlmService(config as never, prisma as never);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('persists a row with the full prompt + response and provider/model when userId is present', async () => {
    await persist({ userId: 'usr_1', diagramId: 'dgm_9', promptName: 'THREAT_ANALYSIS_SYSTEM_PROMPT' });

    expect(prisma.aiInteraction.create).toHaveBeenCalledTimes(1);
    const arg = prisma.aiInteraction.create.mock.calls[0][0];
    expect(arg.data).toEqual(
      expect.objectContaining({
        userId: 'usr_1',
        diagramId: 'dgm_9',
        prompt: 'the full user prompt',
        model: 'anthropic/claude-sonnet-4-6',
        tokensUsed: 42,
        inputTokens: 30,
        outputTokens: 12,
        durationMs: 1234,
      }),
    );
    expect(arg.data.response).toEqual({
      content: 'the full model response text',
      promptName: 'THREAT_ANALYSIS_SYSTEM_PROMPT',
      provider: 'anthropic',
    });
  });

  it('defaults diagramId to null when the config omits it', async () => {
    await persist({ userId: 'usr_1', promptName: 'SYSTEM_PROMPT' });
    expect(prisma.aiInteraction.create.mock.calls[0][0].data.diagramId).toBeNull();
  });

  it('skips persistence for anonymous/system calls (no userId)', async () => {
    await persist({ promptName: 'intel-synthesis' });
    await persist(undefined);
    expect(prisma.aiInteraction.create).not.toHaveBeenCalled();
  });

  it('never throws into the caller when the DB write fails (best-effort logging)', async () => {
    prisma.aiInteraction.create.mockRejectedValueOnce(new Error('db down'));
    await expect(persist({ userId: 'usr_1', promptName: 'SYSTEM_PROMPT' })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('failed to persist aiInteraction'));
  });
});
