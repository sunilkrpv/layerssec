# Drafter

A web-based layered architecture diagramming tool with AI-powered diagram generation, STRIDE threat modeling, and security posture scoring.

**Key features:**
- Layered canvas — drill into any node to create sub-layers
- 22 node types (cloud services, shapes, trust boundaries)
- AI diagram generation and chat via Anthropic Claude
- STRIDE threat analysis with severity scoring
- Security posture score with deterministic threat penalty
- Project versioning (publish → checkout → diff)
- PDF threat report export

Built with Next.js 16, React Flow 11, and Tailwind CSS. Requires [drafter-rest](../drafter-rest) as the backend.

---

## Run Locally

### Prerequisites
- Node.js >= 20.9.0
- [drafter-rest](../drafter-rest) running on port 4000

### Setup

```bash
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Run with Docker

Docker is managed from the `drafter-rest` repo — see its [README](../drafter-rest/README.md#run-with-docker). The frontend container is built and orchestrated from there via `docker compose`.

To build the frontend image standalone:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 \
  -t drafter-frontend .
```

---

## Verify

```bash
npx tsc --noEmit   # must be 0 errors
npm run build      # must complete successfully
```
