# API Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured HTTP request/response logging and AI call logging to the layers-rest NestJS backend.

**Architecture:** An Express-level `HttpLoggingMiddleware` (applied globally in `AppModule`) captures every request and response — including streaming SSE endpoints that bypass NestJS interceptors. `LlmService` gains a `promptName` field in `LlmCallConfig` and emits consistent `info`-level START/DONE log lines for every LLM call. All 18 call sites across `ai.service.ts` and three job processors pass `promptName`.

**Tech Stack:** NestJS `NestMiddleware`, Express `res.on('finish')`, NestJS `Logger`, existing `LlmCallConfig` interface.

---

## File Map

| File | Change |
|------|--------|
| `src/common/middleware/http-logging.middleware.ts` | **New** — Express middleware; logs request + response |
| `src/app.module.ts` | **Modify** — implement `NestModule`, add `configure()` |
| `src/ai/llm.service.ts` | **Modify** — add `promptName` to `LlmCallConfig`; update logging in all 4 LLM methods |
| `src/ai/ai.service.ts` | **Modify** — add `promptName` at 13 call sites |
| `src/jobs/processors/threat-analysis.processor.ts` | **Modify** — add `promptName` at 1 call site |
| `src/jobs/processors/posture-score.processor.ts` | **Modify** — add `promptName` at 2 call sites |
| `src/jobs/processors/attack-simulation.processor.ts` | **Modify** — add `promptName` at 2 call sites |
| `src/common/middleware/http-logging.middleware.spec.ts` | **New** — unit test for middleware |

---

## Task 1: Create `HttpLoggingMiddleware`

**Files:**
- Create: `src/common/middleware/http-logging.middleware.ts`
- Create: `src/common/middleware/http-logging.middleware.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/common/middleware/http-logging.middleware.spec.ts`:

```typescript
import { HttpLoggingMiddleware } from './http-logging.middleware';
import { Logger } from '@nestjs/common';

describe('HttpLoggingMiddleware', () => {
  let middleware: HttpLoggingMiddleware;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    middleware = new HttpLoggingMiddleware();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  function makeReq(overrides: Partial<{ method: string; originalUrl: string; user: { id: string } }> = {}) {
    return { method: 'GET', originalUrl: '/api/projects', ...overrides } as any;
  }

  function makeRes(statusCode = 200) {
    const listeners: Record<string, (() => void)[]> = {};
    return {
      statusCode,
      on: (event: string, cb: () => void) => { (listeners[event] ??= []).push(cb); },
      emit: (event: string) => listeners[event]?.forEach((cb) => cb()),
    } as any;
  }

  it('calls next()', () => {
    const next = jest.fn();
    middleware.use(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('logs the inbound request at info level', () => {
    const next = jest.fn();
    middleware.use(makeReq({ method: 'POST', originalUrl: '/api/ai/generate' }), makeRes(), next);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('POST /api/ai/generate'));
  });

  it('logs response at info level for 200', () => {
    const next = jest.fn();
    const res = makeRes(200);
    middleware.use(makeReq(), res, next);
    res.emit('finish');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('200'));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs response at error level for 500', () => {
    const next = jest.fn();
    const res = makeRes(500);
    middleware.use(makeReq(), res, next);
    res.emit('finish');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('500'));
    expect(logSpy).toHaveBeenCalledTimes(1); // only the inbound line
  });

  it('includes userId from req.user.id when present', () => {
    const next = jest.fn();
    const res = makeRes(200);
    middleware.use(makeReq({ user: { id: 'usr_abc' } }), res, next);
    res.emit('finish');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('usr_abc'));
  });

  it('falls back to anon when req.user is absent', () => {
    const next = jest.fn();
    const res = makeRes(200);
    middleware.use(makeReq(), res, next);
    res.emit('finish');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('anon'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/sunil/Development/github/layers-rest
npx jest src/common/middleware/http-logging.middleware.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './http-logging.middleware'`

- [ ] **Step 3: Create the middleware**

Create `src/common/middleware/http-logging.middleware.ts`:

```typescript
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpLoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const userId = (req as Request & { user?: { id?: string } }).user?.id ?? 'anon';
    const startMs = Date.now();

    this.logger.log(`→  ${method} ${originalUrl} [user:${userId}]`);

    res.on('finish', () => {
      const duration = Date.now() - startMs;
      const { statusCode } = res;
      const line = `←  ${method} ${originalUrl} [user:${userId}] ${statusCode} ${duration}ms`;

      if (statusCode >= 500) {
        this.logger.error(line);
      } else {
        this.logger.log(line);
      }
    });

    next();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/common/middleware/http-logging.middleware.spec.ts --no-coverage
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/common/middleware/http-logging.middleware.ts src/common/middleware/http-logging.middleware.spec.ts
git commit -m "feat: add HttpLoggingMiddleware for request/response logging"
```

---

## Task 2: Register Middleware Globally in `AppModule`

**Files:**
- Modify: `src/app.module.ts`

- [ ] **Step 1: Update `app.module.ts`**

Replace the entire file with:

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { DiagramsModule } from './diagrams/diagrams.module';
import { AiModule } from './ai/ai.module';
import { ChatModule } from './chat/chat.module';
import { RagModule } from './rag/rag.module';
import { ThreatModule } from './threat/threat.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { EncryptionModule } from './encryption/encryption.module';
import { JobsModule } from './jobs/jobs.module';
import { HttpLoggingMiddleware } from './common/middleware/http-logging.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    }),
    EncryptionModule,
    PrismaModule,
    RagModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    DiagramsModule,
    AiModule,
    ChatModule,
    ThreatModule,
    UserSettingsModule,
    JobsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpLoggingMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/app.module.ts
git commit -m "feat: register HttpLoggingMiddleware globally in AppModule"
```

---

## Task 3: Update `LlmService` — Add `promptName`, Fix Logging

**Files:**
- Modify: `src/ai/llm.service.ts`

This task:
1. Adds `promptName?: string` to `LlmCallConfig`
2. Replaces debug-level system-prompt-content logging with `info`-level START/DONE lines
3. Adds START/END logs to `stream()` and `streamConversation()` (currently no logging)
4. Removes verbose debug lines that print raw system prompt and response content

- [ ] **Step 1: Update `LlmCallConfig` interface and `invoke()` method**

In `src/ai/llm.service.ts`, find `LlmCallConfig` (lines 19–27) and add the new field:

```typescript
export interface LlmCallConfig {
  provider?: string;
  model?: string;
  maxOutputTokens?: number;
  numCtx?: number;
  apiKey?: string;
  baseUrl?: string;
  /** Human-readable name of the system prompt constant. Logged instead of prompt content. */
  promptName?: string;
}
```

Then replace the `invoke()` method body (lines 253–287) with:

```typescript
async invoke(systemPrompt: string, userMessage: string, config?: LlmCallConfig): Promise<LlmResponse> {
  const { llm, resolvedProvider, resolvedModel } = this.resolveLlm(config);
  const effectiveSystemPrompt = applyOllamaOptimizations(systemPrompt, resolvedProvider, resolvedModel);
  const name = config?.promptName ?? 'unnamed';
  const startMs = Date.now();

  this.logger.log(`[LLM] START ${name} | ${resolvedProvider}/${resolvedModel} | chars=${userMessage.length}`);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usage = (response as any).usage_metadata as
    | { total_tokens?: number; input_tokens?: number; output_tokens?: number }
    | undefined;
  const tokensUsed = usage?.total_tokens ?? 0;
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const durationMs = Date.now() - startMs;

  this.logger.log(
    `[LLM] DONE  ${name} | ${resolvedProvider}/${resolvedModel} | in=${inputTokens} out=${outputTokens} total=${tokensUsed} tokens | ${durationMs}ms`,
  );

  return { content, tokensUsed, inputTokens, outputTokens, provider: resolvedProvider, model: resolvedModel };
}
```

- [ ] **Step 2: Update `invokeWithThinking()` method**

Replace the log lines inside `invokeWithThinking()` (the two `this.logger.debug` calls at lines 231 and 245) and add START/DONE. The full method body becomes:

```typescript
async invokeWithThinking(systemPrompt: string, userMessage: string, config?: LlmCallConfig): Promise<LlmResponse> {
  const effectiveProvider = config?.provider ?? this.provider;
  if (effectiveProvider !== 'anthropic') {
    this.logger.warn(`Extended thinking requested but effective provider is '${effectiveProvider}' — falling back to standard invoke`);
    return this.invoke(systemPrompt, userMessage, config);
  }

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
  const name = config?.promptName ?? 'unnamed';
  const startMs = Date.now();

  this.logger.log(`[LLM] START ${name} (thinking) | anthropic/${resolvedModel} | chars=${userMessage.length}`);

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
  const durationMs = Date.now() - startMs;

  this.logger.log(
    `[LLM] DONE  ${name} (thinking) | anthropic/${resolvedModel} | in=${inputTokens} out=${outputTokens} total=${tokensUsed} tokens | ${durationMs}ms`,
  );

  return { content, tokensUsed, inputTokens, outputTokens, provider: 'anthropic', model: resolvedModel };
}
```

- [ ] **Step 3: Update `stream()` method**

Replace the `stream()` method body (lines 293–308) with:

```typescript
async *stream(systemPrompt: string, userMessage: string, config?: LlmCallConfig): AsyncGenerator<string> {
  const { llmText, resolvedProvider, resolvedModel } = this.resolveLlm(config);
  const effectiveSystemPrompt = applyOllamaOptimizations(systemPrompt, resolvedProvider, resolvedModel);
  const name = config?.promptName ?? 'unnamed';
  const startMs = Date.now();

  this.logger.log(`[LLM] STREAM START ${name} | ${resolvedProvider}/${resolvedModel} | chars=${userMessage.length}`);

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

  this.logger.log(`[LLM] STREAM END  ${name} | ${resolvedProvider}/${resolvedModel} | ${Date.now() - startMs}ms`);
}
```

- [ ] **Step 4: Update `streamConversation()` method**

Replace the `streamConversation()` method body (lines 314–334) with:

```typescript
async *streamConversation(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
  config?: LlmCallConfig,
): AsyncGenerator<string> {
  const { llmText, resolvedProvider, resolvedModel } = this.resolveLlm(config);
  const effectiveSystemPrompt = applyOllamaOptimizations(systemPrompt, resolvedProvider, resolvedModel);
  const name = config?.promptName ?? 'unnamed';
  const startMs = Date.now();

  this.logger.log(`[LLM] STREAM START ${name} | ${resolvedProvider}/${resolvedModel} | chars=${userMessage.length}`);

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

  this.logger.log(`[LLM] STREAM END  ${name} | ${resolvedProvider}/${resolvedModel} | ${Date.now() - startMs}ms`);
}
```

- [ ] **Step 5: Compile check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/ai/llm.service.ts
git commit -m "feat: add promptName to LlmCallConfig and structured info logging to all LLM methods"
```

---

## Task 4: Add `promptName` to `ai.service.ts` Call Sites

**Files:**
- Modify: `src/ai/ai.service.ts`

There are 13 call sites. Apply each change below exactly.

- [ ] **Step 1: `chatGenerate` — line ~109**

Find:
```typescript
const llmResult = await this.llm.invoke(LAYERS_SYSTEM_PROMPT, userMessage, llmConfig);
```
Replace with:
```typescript
const llmResult = await this.llm.invoke(LAYERS_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'LAYERS_SYSTEM_PROMPT' });
```

- [ ] **Step 2: `chatEvaluate` — line ~187**

Find:
```typescript
for await (const chunk of this.llm.stream(systemPrompt, userContent, llmConfig)) {
```
Replace with:
```typescript
for await (const chunk of this.llm.stream(systemPrompt, userContent, { ...llmConfig, promptName: isQA ? 'QA_SYSTEM_PROMPT' : 'EVAL_SYSTEM_PROMPT' })) {
```

- [ ] **Step 3: `chatAsk` — line ~233**

Find:
```typescript
for await (const chunk of this.llm.streamConversation(
  systemPrompt,
  dto.history ?? [],
  dto.message,
  llmConfig,
)) {
```
Replace with:
```typescript
for await (const chunk of this.llm.streamConversation(
  systemPrompt,
  dto.history ?? [],
  dto.message,
  { ...llmConfig, promptName: dto.layerContext ? 'CHAT_SYSTEM_PROMPT_WITH_LAYER_CONTEXT' : 'CHAT_SYSTEM_PROMPT' },
)) {
```

- [ ] **Step 4: `contextualAsk` — line ~338**

Find:
```typescript
for await (const chunk of this.llm.streamConversation(
  systemPrompt,
  dto.history ?? [],
  dto.message,
  llmConfig,
)) {
```
Replace with:
```typescript
for await (const chunk of this.llm.streamConversation(
  systemPrompt,
  dto.history ?? [],
  dto.message,
  { ...llmConfig, promptName: 'CONTEXTUAL_SYSTEM_PROMPT' },
)) {
```

- [ ] **Step 5: `threatAnalysis` — line ~442**

Find:
```typescript
await this.llm.invoke(THREAT_ANALYSIS_SYSTEM_PROMPT, userMessage, llmConfig);
```
Replace with:
```typescript
await this.llm.invoke(THREAT_ANALYSIS_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'THREAT_ANALYSIS_SYSTEM_PROMPT' });
```

- [ ] **Step 6: `declutter` — line ~502**

Find:
```typescript
await this.llm.invoke(DECLUTTER_SYSTEM_PROMPT, userMessage, llmConfig);
```
Replace with:
```typescript
await this.llm.invoke(DECLUTTER_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'DECLUTTER_SYSTEM_PROMPT' });
```

- [ ] **Step 7: `postureScore` — lines ~548–549 (ternary)**

Find:
```typescript
const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } = dto.useExtendedThinking
  ? await this.llm.invokeWithThinking(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, llmConfig)
  : await this.llm.invoke(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, llmConfig);
```
Replace with:
```typescript
const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } = dto.useExtendedThinking
  ? await this.llm.invokeWithThinking(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'POSTURE_SCORE_SYSTEM_PROMPT' })
  : await this.llm.invoke(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'POSTURE_SCORE_SYSTEM_PROMPT' });
```

- [ ] **Step 8: `attackMind` invokeWithThinking — line ~624**

Find:
```typescript
const result = await this.llm.invokeWithThinking(ATTACK_MIND_SYSTEM_PROMPT, userMessage, llmConfig);
```
Replace with:
```typescript
const result = await this.llm.invokeWithThinking(ATTACK_MIND_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'ATTACK_MIND_SYSTEM_PROMPT' });
```

- [ ] **Step 9: `attackMind` stream — line ~632**

Find:
```typescript
for await (const chunk of this.llm.stream(ATTACK_MIND_SYSTEM_PROMPT, userMessage, llmConfig)) {
```
Replace with:
```typescript
for await (const chunk of this.llm.stream(ATTACK_MIND_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'ATTACK_MIND_SYSTEM_PROMPT' })) {
```

- [ ] **Step 10: `threatAgentChat` — line ~783**

Find:
```typescript
for await (const chunk of this.llm.stream(THREAT_AGENT_SYSTEM_PROMPT, userMessage, llmConfig)) {
```
Replace with:
```typescript
for await (const chunk of this.llm.stream(THREAT_AGENT_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'THREAT_AGENT_SYSTEM_PROMPT' })) {
```

- [ ] **Step 11: `intelSynthesis` — line ~1105**

Find:
```typescript
await this.llm.invoke(systemPrompt, userMessage, llmConfig);
```
in the `intelSynthesis` method (where `systemPrompt` is the inline security architect string). Replace with:
```typescript
await this.llm.invoke(systemPrompt, userMessage, { ...llmConfig, promptName: 'INTEL_SYNTHESIS_SYSTEM_PROMPT' });
```

- [ ] **Step 12: `callAi` private method — line ~1146**

Find:
```typescript
const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } = await this.llm.invoke(SYSTEM_PROMPT, userMessage, llmConfig);
```
Replace with:
```typescript
const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } = await this.llm.invoke(SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'SYSTEM_PROMPT' });
```

- [ ] **Step 13: Compile check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 14: Commit**

```bash
git add src/ai/ai.service.ts
git commit -m "feat: pass promptName to all LLM call sites in AiService"
```

---

## Task 5: Add `promptName` to Job Processor Call Sites

**Files:**
- Modify: `src/jobs/processors/threat-analysis.processor.ts`
- Modify: `src/jobs/processors/posture-score.processor.ts`
- Modify: `src/jobs/processors/attack-simulation.processor.ts`

- [ ] **Step 1: `threat-analysis.processor.ts` — line ~101**

Find:
```typescript
const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } =
  await this.llm.invoke(systemPrompt, userMessage, llmConfig);
```
Replace with:
```typescript
const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } =
  await this.llm.invoke(systemPrompt, userMessage, { ...llmConfig, promptName: 'THREAT_ANALYSIS_SYSTEM_PROMPT' });
```

- [ ] **Step 2: `posture-score.processor.ts` — lines ~121–122 (ternary)**

Find:
```typescript
const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } = dto.useExtendedThinking
  ? await this.llm.invokeWithThinking(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, llmConfig)
  : await this.llm.invoke(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, llmConfig);
```
Replace with:
```typescript
const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } = dto.useExtendedThinking
  ? await this.llm.invokeWithThinking(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'POSTURE_SCORE_SYSTEM_PROMPT' })
  : await this.llm.invoke(POSTURE_SCORE_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'POSTURE_SCORE_SYSTEM_PROMPT' });
```

- [ ] **Step 3: `attack-simulation.processor.ts` — lines ~70–71 (ternary)**

Find:
```typescript
const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } =
  dto.useExtendedThinking
    ? await this.llm.invokeWithThinking(ATTACK_MIND_SYSTEM_PROMPT, userMessage, llmConfig)
    : await this.llm.invoke(ATTACK_MIND_SYSTEM_PROMPT, userMessage, llmConfig);
```
Replace with:
```typescript
const { content, tokensUsed, inputTokens, outputTokens, provider: llmProvider, model: llmModel } =
  dto.useExtendedThinking
    ? await this.llm.invokeWithThinking(ATTACK_MIND_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'ATTACK_MIND_SYSTEM_PROMPT' })
    : await this.llm.invoke(ATTACK_MIND_SYSTEM_PROMPT, userMessage, { ...llmConfig, promptName: 'ATTACK_MIND_SYSTEM_PROMPT' });
```

- [ ] **Step 4: Compile check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/jobs/processors/threat-analysis.processor.ts \
        src/jobs/processors/posture-score.processor.ts \
        src/jobs/processors/attack-simulation.processor.ts
git commit -m "feat: pass promptName to all LLM call sites in job processors"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass (at minimum the 6 middleware tests)

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: build completes with no errors

- [ ] **Step 3: Smoke test — start the server and make one request**

In one terminal:
```bash
npm run start:dev
```

In another terminal:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"x","password":"y"}'
```

Expected server log output:
```
[Nest] INFO  [HttpLoggingMiddleware] →  POST /api/auth/login [user:anon]
[Nest] INFO  [HttpLoggingMiddleware] ←  POST /api/auth/login [user:anon] 401 Xms
```

Expected curl output: `401`
