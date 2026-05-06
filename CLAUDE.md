# Layers Monorepo

This is the Layers monorepo. It contains:

- `apps/frontend` — Next.js web application (formerly `sunilkrpv/layers`)
- `apps/backend`  — NestJS REST API (formerly `sunilkrpv/layers-rest`)
- `assets/`       — Website assets hosted separately

## Working in this repo

Each app has its own `CLAUDE.md` with app-specific instructions:
- Frontend: `apps/frontend/CLAUDE.md`
- Backend:  `apps/backend/CLAUDE.md`

## Running apps

### Frontend (Next.js)
```bash
cd apps/frontend
npm install
npm run dev
```

### Backend (NestJS)
```bash
cd apps/backend
npm install
npm run start:dev
```
