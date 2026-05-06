# API Logging Design

**Date:** 2026-04-11  
**Status:** Approved  
**Scope:** HTTP request/response logging + AI call logging for layers-rest

---

## Problem

No structured logging exists for HTTP requests, responses, or AI calls. When issues occur in production or development there is no trace of what came in, what went out, which model was used, or how many tokens were consumed. Debugging requires guesswork.

---

## Goals

1. Log every inbound HTTP request and outbound response (method, path, userId, status, duration).
2. Log every AI (LLM) call with prompt name, model, provider, user prompt size (chars), and token counts.
3. Never log system prompt content — use the constant name instead.
4. Never log user prompt content — log character count only.
5. Appropriate log levels: `info` for normal traffic, `error` for 5xx.

---

## Architecture

### Component 1 — `HttpLoggingMiddleware`

**File:** `src/common/middleware/http-logging.middleware.ts`

Implements NestJS `NestMiddleware`. Applied globally via `AppModule.configure()` so it covers **all** routes including streaming SSE endpoints (which bypass NestJS interceptors).

**Why middleware, not interceptor:** Several AI endpoints use `@Res()` for SSE streaming — NestJS interceptors are skipped entirely for those routes. Express-level middleware runs unconditionally on every request.

**userId extraction:** `req.user?.id` — JwtAuthGuard populates `req.user` for authenticated routes. Falls back to `'anon'` for public routes (auth, register).

**Response logging:** Hooks `res.on('finish')` so the log fires after the response has been fully flushed to the client (important for streaming endpoints where the response object doesn't close until the stream ends).

**Log format:**
```
→  POST /api/ai/threat-analysis [user:abc123]
←  POST /api/ai/threat-analysis [user:abc123] 200 4231ms
←  POST /api/ai/generate [user:abc123] 500 112ms        ← error level
```

**Log levels:**
- `info` for all inbound requests
- `info` for responses with status < 500
- `error` for responses with status >= 500

4xx responses are `info` (not `warn`) — they represent normal client errors, not server-side faults.

**Registration in AppModule:**
```typescript
// app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggingMiddleware).forRoutes('*');
  }
}
```

---

### Component 2 — `LlmCallConfig.promptName`

**File:** `src/ai/llm.service.ts`

Add one optional field to the existing `LlmCallConfig` interface:
```typescript
export interface LlmCallConfig {
  // ... existing fields ...
  /** Human-readable name of the system prompt constant being used. Logged instead of prompt content. */
  promptName?: string;
}
```

This is non-breaking — all existing call sites continue to work; `promptName` defaults to `'unnamed'`.

---

### Component 3 — `LlmService` logging

**File:** `src/ai/llm.service.ts`

All four LLM methods get structured `info`-level logging. Existing `debug` lines that log raw system prompt content are removed.

#### `invoke()` and `invokeWithThinking()`

Before call:
```
[LLM] START THREAT_ANALYSIS_SYSTEM_PROMPT | anthropic/claude-sonnet-4-6 | chars=1842
```

After call (token counts available from `usage_metadata`):
```
[LLM] DONE  THREAT_ANALYSIS_SYSTEM_PROMPT | anthropic/claude-sonnet-4-6 | in=1200 out=600 total=1800 tokens | 4231ms
```

#### `stream()` and `streamConversation()`

Before stream:
```
[LLM] STREAM START CHAT_SYSTEM_PROMPT | anthropic/claude-sonnet-4-6 | chars=312
```

After stream loop completes:
```
[LLM] STREAM END  CHAT_SYSTEM_PROMPT | anthropic/claude-sonnet-4-6 | 2814ms
```

Token counts are **not available** for streaming calls — LangChain's streaming API does not aggregate `usage_metadata` across chunks. Duration is logged instead.

---

### Component 4 — Call site updates

**Files:** `src/ai/ai.service.ts`, `src/jobs/processors/threat-analysis.processor.ts`, `src/jobs/processors/posture-score.processor.ts`, `src/jobs/processors/attack-simulation.processor.ts`

Each of the 17 `this.llm.invoke/stream/invokeWithThinking` calls gets the `promptName` field added to its config spread:

```typescript
// before
await this.llm.invoke(THREAT_ANALYSIS_SYSTEM_PROMPT, userMessage, llmConfig);

// after
await this.llm.invoke(THREAT_ANALYSIS_SYSTEM_PROMPT, userMessage, {
  ...llmConfig,
  promptName: 'THREAT_ANALYSIS_SYSTEM_PROMPT',
});
```

The prompt name string matches the imported constant name exactly, making it easy to `grep` from logs back to source.

---

## File Inventory

| File | Change type |
|------|-------------|
| `src/common/middleware/http-logging.middleware.ts` | New |
| `src/app.module.ts` | Update — implement `NestModule`, add `configure()` |
| `src/ai/llm.service.ts` | Update — add `promptName` to `LlmCallConfig`, refine logging in all 4 methods |
| `src/ai/ai.service.ts` | Update — add `promptName` at 14 call sites |
| `src/jobs/processors/threat-analysis.processor.ts` | Update — add `promptName` at 1 call site |
| `src/jobs/processors/posture-score.processor.ts` | Update — add `promptName` at 2 call sites |
| `src/jobs/processors/attack-simulation.processor.ts` | Update — add `promptName` at 2 call sites |

---

## Sample Log Output

```
[Nest] INFO  [HttpLoggingMiddleware] →  POST /api/auth/login [user:anon]
[Nest] INFO  [HttpLoggingMiddleware] ←  POST /api/auth/login [user:anon] 200 43ms
[Nest] INFO  [HttpLoggingMiddleware] →  POST /api/ai/threat-analysis [user:usr_abc]
[Nest] INFO  [LlmService] [LLM] START THREAT_ANALYSIS_SYSTEM_PROMPT | anthropic/claude-sonnet-4-6 | chars=2841
[Nest] INFO  [LlmService] [LLM] DONE  THREAT_ANALYSIS_SYSTEM_PROMPT | anthropic/claude-sonnet-4-6 | in=2100 out=980 total=3080 tokens | 6102ms
[Nest] INFO  [HttpLoggingMiddleware] ←  POST /api/ai/threat-analysis [user:usr_abc] 200 6189ms
[Nest] INFO  [HttpLoggingMiddleware] →  POST /api/ai/chat/ask [user:usr_abc]
[Nest] INFO  [LlmService] [LLM] STREAM START CHAT_SYSTEM_PROMPT | anthropic/claude-sonnet-4-6 | chars=412
[Nest] INFO  [LlmService] [LLM] STREAM END  CHAT_SYSTEM_PROMPT | anthropic/claude-sonnet-4-6 | 2814ms
[Nest] INFO  [HttpLoggingMiddleware] ←  POST /api/ai/chat/ask [user:usr_abc] 200 2901ms
[Nest] ERROR [HttpLoggingMiddleware] ←  POST /api/ai/generate [user:usr_abc] 500 112ms
```

---

## Out of Scope

- Log aggregation / shipping (Datadog, Loki) — no infrastructure changes
- Request body logging — security risk, not needed
- Switching to structured JSON (pino) — deferred; can be layered on later without changing this design
- Token counts for streaming calls — not available from LangChain streaming API
