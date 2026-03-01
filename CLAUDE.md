# drafter-rest — Project Intelligence

## Overview
NestJS REST API backend for Drafter (the layered architecture diagramming tool).
Handles authentication, project/diagram storage, and AI interaction tracking.

## Stack
- **Framework**: NestJS 10 (modular, decorator-based)
- **ORM**: Prisma 5 + PostgreSQL (Supabase in production, local postgres in dev)
- **Auth**: JWT (access token 15 min + refresh token 7 d) via `@nestjs/jwt` + `passport-jwt`
- **Passwords**: bcrypt (salt rounds 12)
- **Validation**: `class-validator` + `class-transformer` + global `ValidationPipe`
- **AI**: LangChain (`@langchain/core`, `@langchain/anthropic`, `@langchain/ollama`) — provider selected via `AI_PROVIDER` env var
- **Port**: 4000; CORS allows `http://localhost:3000`

## Key Architectural Patterns

### JWT Auth
- `POST /api/auth/register` — `{ email, password, name? }` → `{ accessToken, refreshToken }`
- `POST /api/auth/login` — `{ email, password }` → `{ accessToken, refreshToken }`
- `POST /api/auth/refresh` — `{ refreshToken }` → new token pair
- All protected routes use `@UseGuards(JwtAuthGuard)` and `@CurrentUser('id')` decorator
- Access token passed as `Authorization: Bearer <token>` header

### Data Model (Prisma schema)
| Model | Key fields |
|-------|-----------|
| `User` | `id` (uuid), `email` (unique), `passwordHash`, `name`, `avatarUrl` |
| `Project` | `id`, `name`, `ownerId → User`, `isPublic`, `tags[]`, timestamps |
| `Diagram` | `id`, `name`, `type` (DiagramType enum), `canvasData` (Json), `projectId → Project`, `version`, timestamps |
| `AiInteraction` | `userId`, `diagramId?`, `prompt`, `response`, `tokensUsed`, `model` |

### Diagram → Drafter mapping
Each Drafter project = one NestJS **Project** + one NestJS **Diagram** (named "main", type `GENERAL`).
The Drafter `ProjectFile` (`{ layers: LayerMap, navStack: string[] }`) is stored as `canvasData` JSON in the Diagram record.
`version` increments on every PATCH (Prisma `{ increment: 1 }`).

### Module Structure
```
src/
  auth/         AuthModule — register, login, refresh; JwtAuthGuard; CurrentUser decorator
  users/        UsersModule — GET /api/users/me
  projects/     ProjectsModule — CRUD for projects
  diagrams/     DiagramsModule — CRUD for diagrams (under /api/projects/:id/diagrams and /api/diagrams/:id)
  prisma/       PrismaModule — global PrismaService (onModuleInit: $connect)
  ai/           AiModule — LangChain LLM orchestration + diagram generation endpoints
    llm.service.ts  — LlmService: selects Anthropic or Ollama at startup via AI_PROVIDER env var
    ai.service.ts   — AiService: generate/suggest/refine; logs to AiInteraction table
    ai.controller.ts — POST /api/ai/generate | /suggest | /refine
    prompts/     — SYSTEM_PROMPT, buildGeneratePrompt, buildRefinePrompt, buildSuggestPrompt
  storage/      StorageModule — Supabase Storage (thumbnails)
```

### LLM Provider Selection (LlmService)
`AI_PROVIDER` env var controls which provider is used at startup:

| `AI_PROVIDER` | Provider | Required env vars |
|---|---|---|
| `anthropic` (default) | Anthropic Claude | `ANTHROPIC_API_KEY`, optionally `ANTHROPIC_MODEL` |
| `ollama` | Ollama (local) | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |

`LlmService` exposes a single `invoke(systemPrompt, userMessage): Promise<{ content, tokensUsed }>` method.
Both providers use LangChain's unified chat model interface — `AiService` is provider-agnostic.

**Ollama quick start:**
```bash
# Install Ollama from https://ollama.com
ollama pull qwen2.5:7b          # or: ollama pull qwen:7b
# Set in .env.local:
#   AI_PROVIDER=ollama
#   OLLAMA_MODEL=qwen2.5:7b
npm run start:dev
```

### Ownership checks
- Projects: `project.ownerId === userId` (enforced in `ProjectsService.ensureOwnership`)
- Diagrams: via `project.ownerId` check in `DiagramsService.findById` (also allows `isPublic`)

## API Endpoints Reference
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh

GET    /api/users/me

GET    /api/projects                    — list user's projects (includes _count.diagrams)
POST   /api/projects                    — create project { name, description?, isPublic?, tags? }
GET    /api/projects/:id               — project + diagrams[] (metadata only, no canvasData)
PATCH  /api/projects/:id               — update project
DELETE /api/projects/:id               — delete project

POST   /api/projects/:id/diagrams      — create diagram { name, type?, canvasData? }
GET    /api/diagrams/:id               — get full diagram (includes canvasData)
PATCH  /api/diagrams/:id               — update diagram { name?, type?, canvasData?, thumbnail? }
DELETE /api/diagrams/:id               — delete diagram
```

## Development Setup
```bash
# First-time local setup
createdb drafter
npm run db:migrate          # applies migrations against local postgres via .env.local

# Run dev server (loads .env.local first)
npm run start:dev

# Useful scripts
npm run db:studio           # Prisma visual DB browser
npm run db:reset            # drop + recreate + re-run all migrations (destructive)
npm run db:generate         # regenerate Prisma Client after schema change
```

## Environment Files
- `.env.local` — local development (gitignored); loaded first by both NestJS (`ConfigModule.forRoot(envFilePath: ['.env.local', '.env'])`) and npm scripts (`dotenv -e .env.local --`)
- `.env` — placeholder/production template (gitignored); overridden by `.env.local` in dev
- `.env.example` — committed template with all required keys

## PR Log

### Initial Setup
- NestJS + Prisma + PostgreSQL schema
- JWT auth (register/login/refresh), bcrypt password hashing
- Projects + Diagrams CRUD with ownership enforcement
- AI interaction tracking model
- Supabase Storage module stub

### LangChain + Ollama integration
- `LlmService` — new service in `ai/` module; reads `AI_PROVIDER` and initialises `ChatAnthropic` or `ChatOllama`
- `AiService` — replaced direct `@anthropic-ai/sdk` calls with `LlmService.invoke()`
- `AiModule` — added `LlmService` to providers + exports
- `model` field in `AiInteraction` now stores `"provider/modelName"` (e.g. `"anthropic/claude-sonnet-4-6"` or `"ollama/qwen2.5:7b"`)
- Packages added: `@langchain/core`, `@langchain/anthropic`, `@langchain/ollama`
- `.env.example` updated with `AI_PROVIDER`, `ANTHROPIC_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`

### Dev Environment
- Added `dotenv-cli` as dev dependency
- `app.module.ts`: `ConfigModule.forRoot({ envFilePath: ['.env.local', '.env'] })`
- All `db:*` scripts + `start:dev` + `start:debug` prefixed with `dotenv -e .env.local --`
- `.env.local` points to `postgresql://postgres:postgres@localhost:5432/drafter`
- `.env.local` added to `.gitignore`
