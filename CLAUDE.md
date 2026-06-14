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
