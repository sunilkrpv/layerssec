# drafter-rest — Project Intelligence

## Overview
NestJS REST API backend for Drafter. Handles authentication, project/diagram storage, versioning, and AI chat interactions.

## Stack
- **Framework**: NestJS 10 (modular, decorator-based)
- **ORM**: Prisma 5 + PostgreSQL (Supabase in production, local postgres in dev)
- **Vector DB**: ChromaDB (local Docker) — `chromadb` npm client; collection `drafter_rag`
- **Auth**: JWT (access token 15 min + refresh token 7 d) via `@nestjs/jwt` + `passport-jwt`
- **Passwords**: bcrypt (salt rounds 12)
- **Validation**: `class-validator` + `class-transformer` + global `ValidationPipe`
- **AI**: LangChain (`@langchain/core`, `@langchain/anthropic`, `@langchain/ollama`) — provider via `AI_PROVIDER` env var
- **Port**: 4000; CORS allows `http://localhost:3000`

---

## Key Architecture

### JWT Auth
- `POST /api/auth/register` — `{ email, password, name? }` → `{ accessToken, refreshToken }`
- `POST /api/auth/login` — `{ email, password }` → `{ accessToken, refreshToken }`
- `POST /api/auth/refresh` — `{ refreshToken }` → new token pair
- Protected routes: `@UseGuards(JwtAuthGuard)` + `@CurrentUser('id')` decorator
- Access token passed as `Authorization: Bearer <token>`

### Data Model (Prisma)
| Model | Key fields |
|-------|-----------|
| `User` | `id` (uuid), `email` (unique), `passwordHash`, `name`, `avatarUrl` |
| `Project` | `id`, `name`, `ownerId → User`, `isPublic`, `tags[]`, timestamps |
| `Diagram` | `id`, `name`, `type`, `canvasData` (Json), `status` (draft/published), `publishComment`, `publishedAt`, `projectId → Project`, `version` |
| `AiInteraction` | `userId`, `diagramId?`, `prompt`, `response`, `tokensUsed`, `model` |
| `ChatMessage` | `id`, `projectId → Project`, `userId → User`, `role` (user/assistant), `content`, `layerId?`, `layerName?`, `diagramData?` (Json), `createdAt` |
| `ThreatModel` | `id`, `projectId → Project`, `diagramId`, `diagramVersion` (int), `snapshotData` (Json), `name`, `savedBy` (userId), `savedAt`; NOT @unique on diagramId (many per diagram) |
| `Threat` | `id`, `threatModelId → ThreatModel`, `targetId`, `targetType`, `targetLabel`, `layerId?`, `strideCategory`, `title`, `description`, `severity` (CRITICAL/HIGH/MEDIUM/LOW/INFO), `status` (OPEN/IN_PROGRESS/MITIGATED/ACCEPTED/FALSE_POSITIVE), `mitigationNotes?`, `identifiedBy` (AI/USER), `createdByUserId?` |

**Drafter mapping**: Each Drafter project = one NestJS `Project` + one NestJS `Diagram` (`canvasData` = `{ layers: LayerMap, navStack: string[] }`). `version` increments on every PATCH via `{ increment: 1 }`.

### Module Structure
```
src/
  auth/         AuthModule — register, login, refresh; JwtAuthGuard; CurrentUser decorator
  users/        UsersModule — GET /api/users/me
  projects/     ProjectsModule — CRUD for projects; versioning (getDraft, listVersions, checkout)
  diagrams/     DiagramsModule — CRUD for diagrams; publish hooks RAG indexing
  chat/         ChatModule — persist + retrieve per-project chat history; hooks RAG indexing
  rag/          RagModule (@Global) — ChromaDB client + indexing + context gathering
    chat.service.ts     — saveMessages(projectId, userId, items[]), getHistory(projectId, userId); also calls ragIndexing.indexChatMessages() non-blocking
    dto/save-chat-messages.dto.ts — ChatMessageItemDto (role, content, layerId?, layerName?, diagramData?)
  rag/          RagModule — @Global(), imported once in AppModule; exports all three services
    chroma.service.ts        — ChromaClient wrapper; upsert/query/deleteByFilter; gracefully disables if ChromaDB unreachable
    rag-indexing.service.ts  — indexPublishedDiagram (called from DiagramsService.publish), indexChatMessages (called from ChatService.saveMessages)
    rag-context.service.ts   — gatherContext(userId, projectId, diagramId, message): runs 4 tools in parallel → context string injected into system prompt
    Tools: semanticSearch (ChromaDB, top-6 results filtered by distance<0.8), getDiagramInfo (Prisma), getDiagramNodes (parse canvasData), listProjectVersions (Prisma)
  prisma/       PrismaModule — global PrismaService (onModuleInit: $connect)
  ai/           AiModule — LangChain LLM orchestration
    llm.service.ts   — LlmService: selects Anthropic or Ollama via AI_PROVIDER; exposes invoke(system, user)
    ai.service.ts    — AiService: generate/suggest/refine/chatGenerate/chatEvaluate/chatAsk
    ai.controller.ts — POST /api/ai/* endpoints
    prompts/
      system-prompt.ts         — SYSTEM_PROMPT (original diagram generation)
      generate-prompt.ts       — buildGeneratePrompt
      refine-prompt.ts         — buildRefinePrompt
      suggest-prompt.ts        — buildSuggestPrompt
      drafter-system-prompt.ts — DRAFTER_SYSTEM_PROMPT (chatGenerate)
      eval-system-prompt.ts         — EVAL_SYSTEM_PROMPT, QA_SYSTEM_PROMPT
      chat-system-prompt.ts         — CHAT_SYSTEM_PROMPT + buildLayerContextSystemPrompt(layerContext)
      contextual-system-prompt.ts   — buildContextualSystemPrompt(contextBlock) for RAG chat
  threat/       ThreatModule — STRIDE threat model persistence + PDF report export (PRDs 2, 8)
    threat.service.ts    — saveThreatModel, listThreatModels, getThreatModel, deleteThreatModel, createThreat, updateThreat, deleteThreat, listProjectThreats (paginated+filtered)
    report.service.ts    — generateProjectReport(projectId, userId): Promise<Buffer>; PDFKit (CJS require); 3-page PDF: cover (score + stats grid), threat catalog (grouped by STRIDE), summary table
    threat.controller.ts — all threat endpoints; route order matters: `projects/:id/threats/report` BEFORE `projects/:id/threats`
    dto/                 — SaveThreatModelDto, UpdateThreatDto, CreateThreatDto
    ai/prompts/threat-analysis-prompt.ts — STRIDE analysis prompt templates per node/edge type
  storage/      StorageModule — Supabase Storage (thumbnails)
```

### PDFKit Usage (ReportService)
- **Import**: Must use `const PDFDocument = require('pdfkit') as typeof import('pdfkit')` — PDFKit is CJS; `import default` resolves to `undefined` at NestJS runtime
- **`bufferPages: true`**: Enables `switchToPage(i)` for post-build page numbers
- **`doc.y` drift**: Every `.text()` call advances `doc.y` regardless of explicit x/y args. Fix: capture `const baseY = doc.y` before any text calls in a grid/table row, use `baseY + offset` for all positions, then explicitly set `doc.y = baseY + rowHeight` after
- **Column layout**: No grid system — track x positions manually; column widths must sum exactly to usable page width (A4: 595pt − 50pt margin × 2 = 495pt)
- **Response**: Use `@Res() res: Response` + `res.end(buffer)` — NestJS won't auto-serialize binary buffers

### LLM Provider Selection
`AI_PROVIDER` env var controls provider at startup:

| `AI_PROVIDER` | Provider | Required env vars |
|---|---|---|
| `anthropic` (default) | Anthropic Claude | `ANTHROPIC_API_KEY`, optionally `ANTHROPIC_MODEL` |
| `ollama` | Ollama (local) | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |

`LlmService.invoke(systemPrompt, userMessage): Promise<{ content, tokensUsed }>` — `AiService` is provider-agnostic. `model` field in `AiInteraction` stores `"provider/modelName"` (e.g. `"anthropic/claude-sonnet-4-6"`).

**Ollama quick start:**
```bash
ollama pull qwen2.5:7b
# .env.local: AI_PROVIDER=ollama, OLLAMA_MODEL=qwen2.5:7b
npm run start:dev
```

### Ownership Checks
- Projects: `project.ownerId === userId` (enforced in `ProjectsService.ensureOwnership`)
- Diagrams: via `project.ownerId` check in `DiagramsService.findById` (also allows `isPublic`)

### Versioning
- `Diagram.status`: `draft` | `published`
- `publish`: sets status=published, snapshots canvasData, increments version
- `checkout`: clones published diagram as new draft (409 `DRAFT_EXISTS` if draft already exists)
- **Checkout rule** (enforced in backend + frontend): Only the **latest** published version may be checked out. If a draft already exists, **no** version may be checked out. Backend throws 409 for existing draft, 400 for non-latest version.
- `getDraft` / `listVersions` on `ProjectsService`; `update` is guarded against published diagrams

### Key AI Protocol: Diagram Extraction
The `---DIAGRAM---` separator is the **primary** protocol for the `chatAsk` endpoint. The AI appends `---DIAGRAM---` + raw JSON (no fences) when the user requests diagram changes. If the AI ignores this and outputs JSON in a ` ```json ``` ` block instead, both the backend (`ai.service.ts` `chatAsk`) and frontend (`splitDiagramContent` in `AIHistoryPage.tsx`) fall back to extracting the **last** code block that parses to `{ nodes[], edges[] }`. Always implement both layers of detection when processing AI responses that may contain diagram JSON.

`buildLayerContextSystemPrompt(layerContext)` injects simplified nodes/edges into the system prompt and specifies the exact node/edge JSON schema + layout guidelines.

---

## API Endpoints
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh

GET    /api/users/me

GET    /api/projects                       — list user's projects
POST   /api/projects                       — create project { name, description?, isPublic?, tags? }
GET    /api/projects/:id                   — project + diagrams[] metadata
PATCH  /api/projects/:id                   — update project
DELETE /api/projects/:id                   — delete project

POST   /api/projects/:id/diagrams          — create diagram { name, type?, canvasData? }
GET    /api/diagrams/:id                   — get full diagram (includes canvasData)
PATCH  /api/diagrams/:id                   — update diagram { name?, type?, canvasData?, thumbnail? }
DELETE /api/diagrams/:id                   — delete diagram
POST   /api/diagrams/:id/publish           — publish diagram { comment? }
GET    /api/projects/:id/versions          — list published versions
GET    /api/projects/:id/draft             — get current draft diagram
POST   /api/projects/:id/checkout          — checkout a published version as new draft

— Threat Modeling (PRDs 2, 3, 8) —
POST   /api/projects/:projectId/threat-models          — save threat model snapshot { name?, diagramId, diagramVersion, snapshotData, threats[] }
GET    /api/projects/:projectId/threat-models          — list saved threat models (summary: threatCount, severitySummary, mitigatedCount)
GET    /api/projects/:projectId/threats/report         — PDF export (PDFKit); returns application/pdf binary
GET    /api/projects/:projectId/threats                — paginated+filtered threats dashboard { page, limit, search, severity, status, strideCategory }
GET    /api/threat-models/:threatModelId               — full threat model with all threats
DELETE /api/threat-models/:threatModelId               — delete threat model
POST   /api/threat-models/:threatModelId/threats       — create user threat { targetId, targetType, targetLabel, strideCategory, title, description, severity, mitigationNotes? }
PATCH  /api/threat-models/:threatModelId/threats/:id   — update threat { title?, description?, status?, severity?, mitigationNotes?, ... }
DELETE /api/threat-models/:threatModelId/threats/:id   — delete individual threat

GET    /api/projects/:id/chat              — get chat history for project
POST   /api/ai/chat/contextual-ask         — RAG-enhanced streaming chat; gathers diagram metadata + nodes + versions + semantic memories; used by AI History page
POST   /api/ai/chat/ask                    — streaming chat with optional layerContext
POST   /api/ai/chat/evaluate               — streaming diagram evaluation (or Q&A with userQuestion)
POST   /api/ai/chat/generate               — generate diagram from prompt (non-streaming)
POST   /api/ai/generate                    — original diagram generation (legacy)
POST   /api/ai/suggest                     — auto-suggest improvements
POST   /api/ai/refine                      — refine existing diagram
POST   /api/ai/threat-analysis             — PRD 3: streaming STRIDE analysis; returns structured threat cards per node/edge; NOT auto-persisted
```

---

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
- `.env.local` — local development (gitignored); loaded first by `ConfigModule.forRoot(envFilePath: ['.env.local', '.env'])` and all `db:*` / `start:*` scripts via `dotenv -e .env.local --`
- `.env` — placeholder/production template (gitignored)
- `.env.example` — committed template with all required keys (`AI_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `DATABASE_URL`, `JWT_SECRET`)
