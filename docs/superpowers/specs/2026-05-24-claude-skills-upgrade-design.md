# Design — CLAUDE.md + Skills Upgrade for Layers Monorepo

**Date:** 2026-05-24
**Status:** Approved (pending spec review)
**Owner:** Sunil Kumar

## Problem Statement

The 3 `CLAUDE.md` files and the existing skills (`frontend-engineer`, `backend-engineer`, `product-manager` ×2) describe an earlier version of Layers. The product has since shipped a different feature set and strategic direction than the docs record. Specifically:

- Docs say AI is **Anthropic + Ollama only**; actual `AiProvider` enum is `ANTHROPIC | OPENAI | OLLAMA | REPLICATE` (4 providers) with per-user BYO encrypted keys.
- Docs frame the **code-scanning / GitHub / PR-webhook roadmap (PRD 5/6/7) as the "deepest competitive moat."** That direction is **dead/replaced**. The shipped direction is: security posture scoring, attack simulation, threat intel, async AI jobs, BYO-AI / air-gap.
- Whole subsystems are undocumented: async jobs (BullMQ), posture scoring, attack simulation, threat intel, declutter, pipeline orchestration, onboarding, encryption, user AI settings, the new app shell + routes.
- `ThreatStatus.OPEN` is now `IDENTIFIED`; posture scores now carry per-layer breakdowns and an extended mode.
- The `product-manager` skill is byte-identical in both apps.

## Goals

1. Refresh all 3 `CLAUDE.md` to match current code, slimmed to orientation-level.
2. Refresh the 3 existing skills.
3. Add 4 new skills: `security-analyst`, `ai-jobs-engineer`, `prompt-engineer`, `design-system`.
4. Restructure skill locations (tiered) and de-duplicate `product-manager`.
5. Re-position the product strategy around the real moat.

## Non-Goals

- No code changes to the product itself.
- No new product features.
- Not reviving the code-scan/GitHub/PR-webhook roadmap (it stays out, may appear only as a forward "candidate" at most — see decision below: it is removed as the north star).

---

## Decisions (locked with user)

| Decision | Choice |
|---|---|
| Scope | All 3 CLAUDE.md + all 3 skills + 4 new skills + restructure |
| Code-scan roadmap | **Dead — replaced.** Remove as moat/north star. |
| product-manager dedup | **Consolidate to root** `.claude/skills/`; delete both app copies. |
| New positioning / moat | **All three combined:** living AI security analysis + air-gap/BYO-AI + visual attack-path simulation. |
| Skill layout | **Tiered** (see below). |
| Doc depth | **Slim CLAUDE.md + deep skills.** |

---

## Final Skill Layout (Tiered)

```
ROOT .claude/skills/
  product-manager/      rewritten — dead roadmap removed, new moat
  security-analyst/     NEW — STRIDE + posture + attack-sim + intel domain brain
  prompt-engineer/      NEW — LangChain prompt library + JSON-extraction protocol
apps/frontend/.claude/skills/
  frontend-engineer/    refreshed — Next 16, RF11, streaming + job-polling UI
  design-system/        NEW — components/ui, AppShell, top-bar pattern, dark mode
apps/backend/.claude/skills/
  backend-engineer/     refreshed — 4 providers, encryption, jobs, ownership
  ai-jobs-engineer/     NEW — BullMQ queues, processors, AiJob lifecycle, BYO-key
```

- Delete `apps/frontend/.claude/skills/product-manager/` and `apps/backend/.claude/skills/product-manager/`.
- Skill discovery is recursive within the repo (confirmed: this session loaded both app-level skills while cwd was repo root), so root-level skills resolve correctly.

## Division of Labor (slim CLAUDE.md + deep skills)

| Lives in CLAUDE.md | Lives in skills |
|---|---|
| Stack, how-to-run, env vars | Domain knowledge (STRIDE / CISSP / compliance) |
| Module / dir structure (where things live) | Engineering standards + reusable patterns |
| Endpoint list, data-model summary | Strategy, positioning, competitive intel |
| Verification commands | Process (write a PRD, review a feature) |
| Hard gotchas (PDFKit, Strict-Mode refs, posture penalty) — short, with link to skill | Persona / mindset; the full gotcha explanation |

Each gotcha is documented in **one** authoritative place (the relevant skill); CLAUDE.md keeps a one-line pointer.

---

## Corrected Feature Catalog (single source of truth)

This table replaces the old "PRD 1–8 shipped/unshipped" framing everywhere it appears.

| # | Feature | Code anchor |
|---|---|---|
| 1 | Architecture diagramming + trust boundaries | RF11 canvas, `TrustBoundaryNode`, drill-down layers, `trust-map` route/lib |
| 2 | STRIDE threat analysis | `/api/ai/threat-analysis` (stream + `/submit` job + `/chat` refine); `ThreatModel` + `Threat` |
| 3 | Security posture score | `/api/ai/posture-score` (`/stream`, `/submit`); LLM 5-dim + **deterministic threat penalty**; per-layer `layerScores`; `useExtended` |
| 4 | Attack simulation | `/api/ai/attack-mind` (`/stream`, `/submit`); `entryPointNodeId`; `AttackPathOverlay`; saved `AttackSimulation` |
| 5 | Threat intel | `/api/ai/intel-synthesis`, `/api/projects/:id/intel-report`; `SecurityIntelPage` |
| 6 | Declutter | `/api/ai/declutter`; `DeclutterOverlay` (AI auto-layout/cleanup) |
| 7 | Threats dashboard | paginated/filtered table; status incl `FALSE_POSITIVE` / `MITIGATED`; PDF report export |
| 8 | Version + diff | publish / checkout, `DiffPage`, `VersionCompareSheet` |
| 9 | Pipeline orchestration | `/api/ai/projects/:id/pipeline-status`, `PipelineNudge`, `pipelineState` — threat→posture→attack chain |
| 10 | BYO-AI + air-gap | `UserAiSettings`, 4 providers, AES-256-GCM keys, `/api/user-settings/ai-metrics` |
| 11 | Async AI jobs | BullMQ, 3 processors (+declutter), `AiJob` lifecycle, `/api/jobs/activity`, cancel |
| 12 | Onboarding | milestone tracking (`UserOnboarding`), tour, checklist, nudges |

### Verified backend endpoint surface (for backend CLAUDE.md)
- **ai**: `generate`, `suggest`, `refine`, `chat/generate`, `chat/evaluate`, `chat/ask`, `chat/contextual-ask`, `threat-analysis`, `threat-analysis/chat`, `threat-analysis/submit`, `posture-score`, `posture-score/stream`, `posture-score/submit`, `attack-mind`, `attack-mind/stream`, `declutter`, `intel-synthesis`, `projects/:projectId/pipeline-status`
- **jobs**: `activity`, list, `:id/status`, `:id/cancel`
- **threat**: threat-models CRUD, `threats/report` (PDF), threats dashboard (paginated/filtered), `posture-score/history`, `posture-scores/:id`, attack-simulations CRUD, `intel-report`
- **user-settings**: `ai-settings`, `ai-metrics`
- **onboarding**: `GET`, `PATCH`

### Key data-model facts (for backend CLAUDE.md)
- `AiProvider`: ANTHROPIC | OPENAI | OLLAMA | REPLICATE
- `AiJobType`: THREAT_ANALYSIS | POSTURE_SCORE | ATTACK_SIMULATION | DECLUTTER
- `AiJobStatus`: PENDING | RUNNING | COMPLETED | FAILED | CANCELLED (`progress`, `resultRef`, `errorMessage`)
- `ThreatStatus`: IDENTIFIED | IN_PROGRESS | MITIGATED | ACCEPTED | FALSE_POSITIVE (note: `IDENTIFIED`, not `OPEN`)
- `PostureScore`: `score`, `dimensions`, `deductions`, `additions`, `summary`, `topRecs`, `layerScores` (per-layer, nullable), `useExtended`
- `AttackSimulation`: `entryPointNodeId`, `content`, `useExtended`, `name`
- `UserAiSettings`: `provider`, `model`, `maxInput/OutputTokens`, `ollamaBaseUrl`, `openAiBaseUrl`, `encryptedAnthropicKey`, `encryptedOpenAiKey` (AES-256-GCM `iv:authTag:ciphertext`, never expose plaintext)
- `Threat`: adds `mitigationAdvice`, `codeEvidence` (Json), `layerId` now required

---

## New Positioning (product-manager skill)

**Moat = three things together, which no single competitor offers:**
1. **Living AI security analysis** — STRIDE + posture score + attack simulation + threat intel, all re-runnable as the architecture changes (no source code required).
2. **Air-gap / BYO-AI** — fully local via Ollama, or bring-your-own Anthropic/OpenAI key; nothing leaves the org. Self-hostable.
3. **Visual attack-path simulation** — exploit chains rendered over the DFD across trust boundaries, not just a flat threat list.

- **Remove** PRD 5/6/7 (code scanning / GitHub / PR webhook) as the north star and "deepest moat."
- **Keep** the CISSP 8-domain mapping, STRIDE per-element knowledge, compliance framework mapping, competitive-intel table, PRD template, and "how to think as PM" — these stay valuable; reframe the competitive edge around the 3 combined pillars.
- **Keep** dual ICP (developer/eng teams primary; enterprise CISO/GRC secondary).
- Forward roadmap candidates only (not commitments): LINDDUN privacy mode, MITRE ATT&CK mapping, ISO/SOC2 control mapping per threat, multi-user collaboration, threat-model diff view.

---

## Per-Skill Content Outlines

### ROOT — product-manager (rewrite)
Dual ICP · new 3-pillar positioning · corrected feature catalog · CISSP/STRIDE/compliance KB (kept) · refreshed competitive intel · PRD template · "how to think as PM" · forward-candidate roadmap (no dead code-scan moat). Cross-links `security-analyst` for the domain detail rather than duplicating STRIDE tables.

### ROOT — security-analyst (NEW)
The domain brain, extracted from `product-manager` so engineering skills can reference one source:
- STRIDE per-element question tables (process / data store / data flow / trust-boundary crossing / external entity)
- Trust-boundary auto-elevation rule
- **Posture scoring model**: 5 CISSP dimensions (Attack Surface, Identity, Data Protection, Network Segmentation, Resilience & Monitoring); two-phase scoring — LLM structural 0–100 then **deterministic penalty** `CRITICAL×4 + HIGH×2 + MEDIUM×0.5`, `final = max(0, llm − penalty)`; per-layer scoring; extended mode
- Attack-simulation reasoning (entry-point → reachable path → exploit chain across boundaries)
- Threat-intel synthesis logic
- Context-aware STRIDE per diagram context (webapp / backend / LLM-app / cloud infra)

### ROOT — prompt-engineer (NEW)
- Prompt-library map: `generate`, `refine`, `suggest`, `eval`/`QA`, `chat`, `contextual`, `threat-analysis`, `posture-score`, `attack-mind`, `declutter`, `intel`
- Provider-agnostic prompting across 4 providers (no provider-specific syntax in shared prompts)
- `---DIAGRAM---` extraction protocol + last-```json```-block fallback (both layers always implemented)
- Prompt logging rules: never log system/user prompt content; log constant name + char count; `promptName` in `LlmCallConfig`
- Streaming vs structured-JSON output patterns

### FRONTEND — frontend-engineer (refresh)
Next 16 App Router · React 18 · RF11 · TS strict · Tailwind v3 dark mode. **Add:** SSE streaming consumption **and async job-polling** pattern (submit → poll `:id/status` → render `resultRef`); refs-for-stale-closure; pure `setState` updaters (Strict-Mode safe); `ExtendedRFInstance`; overlay components (`ThreatOverlay`, `AttackPathOverlay`, `DeclutterOverlay`). Verification: `npx tsc --noEmit`, `npm run build`. Fix stale "Next.js 14" in description.

### FRONTEND — design-system (NEW)
- `components/ui` primitives + `app/dev/primitives` gallery
- `AppShell` / `HomeSidebar` navigation shell
- The secondary-page **top-bar pattern** (moved out of CLAUDE.md, authoritative here)
- Theme system / dark mode (`ThemeProvider`, FOUC script, `dark:` variants)
- Badge conventions (`threatBadges`, `projectBadges`)
- Panel docking patterns (right-docked panels, ⌘ toggles)

### BACKEND — backend-engineer (refresh)
NestJS / Prisma 5 / JWT (access + refresh families) · **security-first**: BOLA/IDOR/ownership on every endpoint, prompt-injection awareness · thin controllers / service-owned logic · immutability guards (no mutating published diagrams). **Add:** 4-provider abstraction via `LlmService`; **encryption module** (AES-256-GCM, never expose plaintext keys, never log them). Keep short pointers to PDFKit gotcha + posture-penalty rule (full text lives in `ai-jobs-engineer` / `security-analyst`).

### BACKEND — ai-jobs-engineer (NEW)
- BullMQ queue definitions (`jobs/queues.ts`) + Redis (`ioredis`) dependency
- 3 processors (`threat-analysis`, `posture-score`, `attack-simulation`) + `DECLUTTER` job type
- `AiJob` lifecycle: PENDING → RUNNING → COMPLETED/FAILED/CANCELLED; `progress`, `resultRef`, `errorMessage`
- Submit-vs-stream decision guidance (when to enqueue a job vs SSE-stream)
- `LlmService` provider selection driven by `UserAiSettings` (provider, model, base URLs, decrypted key)
- Activity feed (`/api/jobs/activity`) + cancel
- The **deterministic posture-penalty rule** authoritative text lives here (referenced by `security-analyst` and backend CLAUDE.md)

### 3 CLAUDE.md (slim)
- **root**: monorepo orientation, both apps, shared infra (Postgres / Redis / ChromaDB / Supabase), the corrected feature catalog at a glance, where each app's CLAUDE.md + skills live.
- **frontend**: Next 16 / RF11 structure; route map (`home`, `activity`, `intel`, `trust-map`, `threats`, `ai-history`, `diff`, `dev/primitives`); where components/lib live; verification commands. Deep patterns → `frontend-engineer` / `design-system`.
- **backend**: module list (incl. `jobs`, `encryption`, `user-settings`, `onboarding`); verified endpoint surface; data-model summary; run/migrate commands; must-keep gotchas as one-liners with links. Deep domain → `security-analyst` / `prompt-engineer` / `ai-jobs-engineer`.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Skill content drifts from code again | Slim CLAUDE.md + single-source gotchas reduce duplication; feature catalog is the one table to update |
| Recursive discovery loads duplicate/conflicting skills | Delete both app `product-manager` copies; verify only 7 skills resolve after move |
| Inaccurate feature claims in skills | Implementation step reads each module before writing its skill (per-skill grounding) |
| Cross-skill references go stale | Link by skill name + section heading, not line numbers |

## Acceptance Criteria

- [ ] 7 skills exist at the tiered locations; 0 `product-manager` duplicates remain.
- [ ] No skill or CLAUDE.md still names code-scanning/GitHub/PR-webhook as the moat/north star.
- [ ] Backend CLAUDE.md endpoint list + data model match `schema.prisma` and the controllers.
- [ ] AI providers documented as 4 (Anthropic/OpenAI/Ollama/Replicate) everywhere.
- [ ] `ThreatStatus` documented as `IDENTIFIED` (not `OPEN`).
- [ ] Posture penalty formula appears in exactly one authoritative skill; others link to it.
- [ ] Each CLAUDE.md is meaningfully slimmer; deep patterns relocated to skills.
- [ ] Frontend skill documents the job-polling pattern, not just streaming.
