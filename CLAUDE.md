# Layers Monorepo

Layers is an AI-driven security platform: build an architecture diagram, then run STRIDE threat
analysis, security posture scoring, attack simulation, and threat intel on it — all re-runnable as the
architecture changes, on any of 4 AI providers (including fully-local Ollama for air-gap).

## Repo Layout
- `apps/frontend` — Next.js web app (React Flow canvas)
- `apps/backend`  — NestJS REST API (LLM orchestration, persistence, jobs)
- `assets/`       — website assets (hosted separately)
- `docs/`         — specs + plans (`docs/superpowers/`)

Each app has its own `CLAUDE.md` for orientation:
- Frontend: `apps/frontend/CLAUDE.md`
- Backend:  `apps/backend/CLAUDE.md`

## Shared Infrastructure
- **PostgreSQL** — primary store (Supabase in prod, local postgres in dev)
- **Redis** — BullMQ queue backing async AI jobs
- **ChromaDB** — vector store for RAG (contextual chat)
- **Supabase Storage** — diagram thumbnails

## Feature Catalog (current)
| # | Feature |
|---|---------|
| 1 | Architecture diagramming + trust boundaries (drill-down layers, trust-map) |
| 2 | STRIDE threat analysis (stream + async job + chat-refine) |
| 3 | Security posture score (5 CISSP dims + deterministic threat penalty; per-layer) |
| 4 | Attack simulation (APT-style attack paths, visual overlay) |
| 5 | Threat intel synthesis + report |
| 6 | Declutter (AI auto-layout) |
| 7 | Threats dashboard (status, mitigations, false positives; PDF export) |
| 8 | Versioning + visual diff |
| 9 | Pipeline orchestration (threat → posture → attack) |
| 10 | BYO-AI + air-gap (Anthropic / OpenAI / Ollama / Replicate; encrypted keys) |
| 11 | Async AI jobs (BullMQ; progress + cancel) |
| 12 | Onboarding (milestones, tour, nudges) |

## Skills (`.claude/skills/`)
Deep domain, patterns, and strategy live in skills, not in these CLAUDE.md files.
- **Root**: `product-manager` (strategy/positioning), `security-analyst` (STRIDE/posture/attack/intel domain), `prompt-engineer` (prompt library + extraction)
- **Frontend**: `frontend-engineer` (Next 16 / RF11 / streaming + job polling), `design-system` (UI primitives, shell, theme)
- **Backend**: `backend-engineer` (NestJS/Prisma/security/encryption), `ai-jobs-engineer` (BullMQ jobs, provider/BYO-key)

## Running Apps
```bash
# Frontend (Next.js)
cd apps/frontend && npm install && npm run dev

# Backend (NestJS)
cd apps/backend && npm install && npm run start:dev
```

## graphify

Knowledge graphs are **per-app**, not at the repo root. Each app has its own graph:
- Frontend: `apps/frontend/graphify-out/`
- Backend:  `apps/backend/graphify-out/`

`cd` into the relevant app directory before running any `graphify` command so it
resolves that app's `graphify-out/`.

Rules (run from inside the app dir):
- For codebase questions, first run `graphify query "<question>"` when the app's `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If the app's `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read the app's `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` from within that app dir to keep its graph current (AST-only, no API cost).
