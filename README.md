# layers-rest

NestJS REST API backend for [Layers](../layers). Handles authentication, project and diagram storage, versioning, AI chat, STRIDE threat modeling, and security posture scoring.

**Stack:** NestJS 10 · Prisma 5 · PostgreSQL · Redis (BullMQ) · ChromaDB (RAG) · Anthropic Claude / Ollama

---

## Run Locally

### Prerequisites
- Node.js >= 20
- PostgreSQL running locally (`createdb layers`)
- Docker (for Redis + ChromaDB)

### 1. Start infrastructure

```bash
docker compose up -d chromadb redis
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

Required keys:

| Key | Description |
|-----|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Random 32+ char strings |
| `AI_PROVIDER` | `anthropic` or `ollama` |
| `ANTHROPIC_API_KEY` | Required when `AI_PROVIDER=anthropic` |
| `ENCRYPTION_KEY` | 64 hex chars — `openssl rand -hex 32` |

### 4. Run migrations and start

```bash
npm run db:migrate     # applies Prisma migrations
npm run start:dev      # starts on port 4000 with hot reload
```

---

## Run with Docker

All services (postgres, chromadb, redis, backend, frontend) run via a single `docker compose` command.

### 1. Configure environment

```bash
cp .env.example .env.docker
```

Edit `.env.docker` and set real values for:
- `JWT_SECRET` and `JWT_REFRESH_SECRET` — `openssl rand -hex 32`
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `ENCRYPTION_KEY` — `openssl rand -hex 32` (must be exactly 64 hex chars)

### 2. Build and start

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| PostgreSQL | localhost:5432 |
| ChromaDB | http://localhost:8001 |

### Subsequent runs

```bash
docker compose up        # start (no rebuild)
docker compose down      # stop (data retained)
docker compose down -v   # stop AND delete all data volumes
```

Postgres and ChromaDB data persists in named Docker volumes across restarts. Both services have `restart: unless-stopped` so they recover automatically after a host reboot.

### Rebuild after code changes

```bash
docker compose up --build backend    # rebuild backend only
docker compose up --build frontend   # rebuild frontend only
docker compose up --build            # rebuild everything
```

---

## Useful Scripts

```bash
npm run db:studio      # Prisma visual database browser
npm run db:reset       # drop + recreate + re-run all migrations (destructive)
npm run db:generate    # regenerate Prisma client after schema change
npm run start:prod     # run compiled output (no hot reload)
```

## AI Providers

| `AI_PROVIDER` | Required env vars |
|---|---|
| `anthropic` (default) | `ANTHROPIC_API_KEY`, optionally `ANTHROPIC_MODEL` |
| `ollama` | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |

Ollama quick start:
```bash
ollama pull qwen2.5:7b
# .env.local: AI_PROVIDER=ollama, OLLAMA_MODEL=qwen2.5:7b
```
