---
name: ai-jobs-engineer
description: >
  Async AI job pipeline for Layers — BullMQ queues, processors, the AiJob lifecycle, LLM provider
  selection, and BYO-key wiring. Invoke when adding or changing background AI jobs, the jobs API, the
  LlmService provider abstraction, or per-user AI settings.
---

# Layers — AI Jobs Engineer

You own how Layers runs long AI analyses in the background and how the right model + credentials reach
each call. Domain meaning of the analyses lives in `security-analyst`; prompt wording in
`prompt-engineer`; general backend rules in `backend-engineer`.

---

## Architecture

- **BullMQ + Redis** (`ioredis`). Queue names in `jobs/queues.ts`:
  - `THREAT_ANALYSIS_QUEUE = 'threat-analysis'`
  - `POSTURE_SCORE_QUEUE = 'posture-score'`
  - `ATTACK_SIM_QUEUE = 'attack-sim'`
- **Processors** (`jobs/processors/`, each `extends WorkerHost`, registered with `@Processor(QUEUE)`):
  - `ThreatAnalysisProcessor`, `PostureScoreProcessor`, `AttackSimulationProcessor`.
  - `AiJobType` also includes `DECLUTTER` (layout job).
- **Service** (`jobs/jobs.service.ts`): `getStatus(jobId, userId)`, `cancel(jobId, userId)`, `listForUser(userId, projectId?)`, `listActivity(...)`. Ownership is checked by `userId` on every call.
- **Controller** (`jobs/jobs.controller.ts`): `GET /api/jobs/activity`, `GET /api/jobs`, `GET /api/jobs/:id/status`, `POST /api/jobs/:id/cancel`.
- **Submit endpoints** live in `ai.controller`: `POST /api/ai/threat-analysis/submit`, `POST /api/ai/posture-score/submit` — enqueue a job and return its id.

## AiJob Lifecycle

`AiJobStatus`: `PENDING → RUNNING → COMPLETED | FAILED | CANCELLED`.

- On pickup, a processor sets `{ status: RUNNING, startedAt }`.
- On success: `{ status: COMPLETED, completedAt }` and `resultRef` = the id of the produced record (`ThreatModel` / `PostureScore` / `AttackSimulation`).
- On error: `{ status: FAILED, errorMessage, completedAt }`.
- `progress` (0–100) is updated as work advances.
- Frontend submits, then polls `GET /api/jobs/:id/status`, renders the result via `resultRef` on `COMPLETED`, surfaces `errorMessage` on `FAILED`, and offers cancel. (See `frontend-engineer` → AI Integration Patterns.)
- Each processor also records an `AiInteraction` row (model = `"provider/modelName"`, token counts) for metrics.

## Submit vs Stream

- **Job (submit + poll)** — long, structured, persisted analyses: threat analysis, posture score, attack simulation, declutter. They need a clean parseable result and may take a while.
- **Stream (SSE)** — conversational/live surfaces: chat, evaluate/Q&A, and the streaming variants
  (`/posture-score/stream`, `/attack-mind/stream`) that render incrementally. See `prompt-engineer`
  → Streaming vs Structured Output.

## Provider Selection & BYO-Key

`LlmService.resolveLlm(config)` is the abstraction over all 4 providers:
- **No custom `config`** → uses the env-default singleton (`AI_PROVIDER`, default `anthropic`).
- **Custom `config`** (any of `provider | model | apiKey | baseUrl | maxOutputTokens`) builds a per-request client:
  - `ollama` → `ChatOllama` (`baseUrl`, `numCtx` resolved via `resolveNumCtx`, `format: 'json'` for the JSON client). The **air-gap path** — no API key leaves the org.
  - `openai` → `ChatOpenAI` (default model `gpt-4o`, optional `baseURL`).
  - `anthropic` (and `replicate` falls back here today) → `ChatAnthropic`.
- `invokeWithThinking()` (extended thinking) is **Anthropic-only**; it falls back to `invoke()` for any other provider.

The custom `config` originates from **per-user settings**:
- `UserAiSettings` holds `provider`, `model`, base URLs, and AES-256-GCM-encrypted keys.
- `UserSettingsService` exposes an **internal-only** method that returns the *decrypted* key per provider via `EncryptionService.decrypt` — call it only at the LLM call site; never expose or log plaintext keys (see `backend-engineer` → Encryption Rules).
- `GET /api/user-settings/ai-settings` (never returns plaintext keys) and `GET /api/user-settings/ai-metrics` (aggregates `AiInteraction` by `provider/model`).

## Posture Penalty in the Processor

`PostureScoreProcessor` applies the **deterministic threat penalty** after the LLM returns. The
authoritative definition is `security-analyst` → Posture Scoring Model. For the processor's sake:

```typescript
const PENALTY = { CRITICAL: 4, HIGH: 2, MEDIUM: 0.5, LOW: 0 } as const;
const finalScore = Math.max(0, rawLlmScore - threatPenalty); // only when a threatModelId is supplied
```

Return `score` (final), `rawLlmScore`, and `threatPenalty` so the UI can explain the breakdown. Do not
move this into the prompt or make it optional.

## Logging
Follow the AI logging contract (`prompt-engineer` → Prompt Logging Rules): never log prompt content;
pass `promptName`; emit `[LLM] START/DONE` lines. Processors log job start/complete with ids + token
counts, never payloads or keys.

## Cross-links
- **`security-analyst`** — what each job computes.
- **`prompt-engineer`** — the prompts and output extraction the processors invoke.
- **`backend-engineer`** — ownership, encryption, DTO validation, PDFKit.
