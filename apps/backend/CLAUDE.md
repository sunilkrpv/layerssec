# Layers — Backend (orientation)

NestJS REST API for Layers: auth, project/diagram storage + versioning, multi-provider LLM
orchestration, async AI jobs, and the security-analysis features (STRIDE, posture, attack sim, intel).

**Deep detail lives in the backend skills, not here:**
- `.claude/skills/backend-engineer` — NestJS/Prisma/JWT, ownership (BOLA/IDOR), encryption, PDFKit, immutability.
- `.claude/skills/ai-jobs-engineer` — BullMQ queues, AiJob lifecycle, provider selection + BYO-key.
- `.claude/skills/prompt-engineer` — prompt library, `---DIAGRAM---` extraction, LLM logging.
- `.claude/skills/security-analyst` — STRIDE per element, posture scoring model (penalty formula), attack sim, intel.

## Stack
- NestJS 10 (modular, decorator-based); port 4000; CORS allows `http://localhost:3000`
- Prisma 5 + PostgreSQL (Supabase prod / local dev)
- Redis + BullMQ (async AI jobs); ChromaDB (RAG; collection `layers_rag`)
- JWT (access 15m + refresh-token families 7d), bcrypt (rounds 12), `class-validator` + global `ValidationPipe`
- LangChain multi-provider: `@langchain/anthropic | openai | ollama` via `LlmService` (`AI_PROVIDER` env default)

## Modules (`src/`)
| Module | Responsibility |
|--------|----------------|
| `auth` | register/login/refresh; `JwtAuthGuard`; `@CurrentUser` |
| `users` | `GET /api/users/me` |
| `projects` | project CRUD; versioning (getDraft, listVersions, checkout) |
| `diagrams` | diagram CRUD; publish hooks RAG indexing |
| `chat` | per-project chat persistence; RAG indexing |
| `rag` | `@Global` ChromaDB client + indexing + `gatherContext` (semantic search, diagram info/nodes, versions) |
| `ai` | `LlmService` + `AiService` + prompts; all `/api/ai/*` endpoints |
| `jobs` | BullMQ queues + 3 processors + AiJob status/cancel/activity |
| `threat` | threat-model + threat persistence; posture/attack history; PDF report |
| `user-settings` | per-user AI provider/model/keys; usage metrics |
| `encryption` | AES-256-GCM for sensitive fields (BYO keys) |
| `onboarding` | onboarding milestone state |
| `prisma` | global `PrismaService` |
| `common` | HTTP logging middleware, shared utils |

## Data Model (summary)
- **Providers** — `AiProvider`: `ANTHROPIC | OPENAI | OLLAMA | REPLICATE`.
- **Jobs** — `AiJob` (`type`, `status`, `progress`, `resultRef`, `errorMessage`); `AiJobType`: `THREAT_ANALYSIS | POSTURE_SCORE | ATTACK_SIMULATION | DECLUTTER`; `AiJobStatus`: `PENDING | RUNNING | COMPLETED | FAILED | CANCELLED`.
- **Threats** — `ThreatModel` (version-aware snapshot, many per diagram) → `Threat` (`strideCategory`, `severity`, `status`, `identifiedBy`, `mitigationAdvice`, `codeEvidence`, `layerId`). `ThreatStatus`: `IDENTIFIED | IN_PROGRESS | MITIGATED | ACCEPTED | FALSE_POSITIVE` (note: `IDENTIFIED`, not `OPEN`).
- **Posture** — `PostureScore` (`score`, `rawLlmScore`-derived, `dimensions`, `deductions`, `additions`, `topRecs`, per-layer `layerScores`, `useExtended`).
- **Attack** — `AttackSimulation` (`entryPointNodeId`, `content`, `useExtended`).
- **Settings** — `UserAiSettings` (`provider`, `model`, base URLs, `encryptedAnthropicKey`/`encryptedOpenAiKey` — AES-256-GCM `iv:authTag:ciphertext`, never expose plaintext).
- **Other** — `User`, `RefreshToken`, `Project`, `Diagram` (`canvasData` Json, `status`, `version`), `AiInteraction`, `ChatMessage`, `UserOnboarding`.

## Endpoint Surface
```
auth:     POST /api/auth/register | login | refresh
users:    GET  /api/users/me
projects: GET|POST /api/projects ; GET|PATCH|DELETE /api/projects/:id
          POST /api/projects/:id/diagrams ; GET /api/projects/:id/versions | /draft ; POST /api/projects/:id/checkout
diagrams: GET|PATCH|DELETE /api/diagrams/:id ; POST /api/diagrams/:id/publish
ai:       POST /api/ai/generate | suggest | refine
          POST /api/ai/chat/generate | chat/evaluate | chat/ask | chat/contextual-ask
          POST /api/ai/threat-analysis | threat-analysis/chat | threat-analysis/submit
          POST /api/ai/posture-score | posture-score/stream | posture-score/submit
          POST /api/ai/attack-mind | attack-mind/stream
          POST /api/ai/declutter | intel-synthesis
          GET  /api/ai/projects/:projectId/pipeline-status
jobs:     GET  /api/jobs | /api/jobs/activity | /api/jobs/:id/status ; POST /api/jobs/:id/cancel
threat:   POST|GET /api/projects/:id/threat-models ; GET /api/threat-models/:id ; DELETE /api/threat-models/:id
          POST /api/threat-models/:id/threats ; PATCH|DELETE /api/threat-models/:id/threats/:threatId
          GET  /api/projects/:id/threats (paginated/filtered) | /threats/:threatId | /threats/report (PDF)
          GET  /api/projects/:id/posture-score/history | /api/posture-scores/:id
          POST|GET /api/projects/:id/attack-simulations ; GET|DELETE /api/attack-simulations/:id
          POST /api/projects/:id/intel-report
settings: GET  /api/user-settings/ai-settings | /api/user-settings/ai-metrics
onboard:  GET|PATCH /api/onboarding
```
Route order: in `threat.controller`, declare `projects/:id/threats/report` **before** `projects/:id/threats/:threatId`.

## Gotchas (pointers)
- Posture deterministic threat penalty → `security-analyst` (Posture Scoring Model); applied in `jobs/processors/posture-score.processor.ts`.
- Job lifecycle + provider/BYO-key wiring → `ai-jobs-engineer`.
- LLM logging (never log prompt content to **stdout**; pass `promptName`) + `---DIAGRAM---` extraction → `prompt-engineer`.
- **Centralized AI activity logging.** Every LLM call (`invoke` / `invokeWithThinking` / `stream` / `streamConversation`) is persisted to the `ai_interactions` table **inside `LlmService`** — do NOT add per-feature `aiInteraction.create` calls. Pass `userId` (and optional `diagramId`) via `LlmCallConfig`; `buildLlmConfigForUser` stamps `userId` automatically, so any call site that spreads that config is logged for free. Calls without a `userId` (anonymous/system) are intentionally not persisted (the row requires a user FK). The full prompt + response text land in the DB row; stdout still prints only `promptName`.
- Encryption (AES-256-GCM, never log/expose keys) + PDFKit quirks + immutability guards → `backend-engineer`.

## Dev Setup
```bash
createdb layers
npm run db:migrate     # apply migrations (uses .env.local first)
npm run start:dev      # dev server
npm run db:studio      # Prisma browser
npm run db:generate    # regen client after schema change
```
Env files: `.env.local` (dev, gitignored, loaded first), `.env` (template, gitignored), `.env.example`
(committed; keys incl. `AI_PROVIDER`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, `OPENAI_API_KEY`,
`OLLAMA_BASE_URL`/`OLLAMA_MODEL`, `DATABASE_URL`/`DIRECT_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`).

## graphify
This app has its own knowledge graph at `apps/backend/graphify-out/` (graphs are per-app,
not at the repo root). `cd apps/backend` before running any `graphify` command so it resolves
this app's graph; run `graphify update .` from here after changing backend code.
