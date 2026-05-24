# CLAUDE.md + Skills Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the 3 CLAUDE.md files and 3 existing skills, add 4 new skills, and restructure skill locations to match Layers' current code and strategy.

**Architecture:** Tiered skill layout (cross-cutting skills at repo root, app-specific in each app). Slim CLAUDE.md (orientation) + deep skills (domain/patterns/strategy). Each gotcha documented once with cross-links.

**Tech Stack:** Markdown skills with YAML frontmatter (`name`, `description`). No code/tests — verification is grep + file-existence + skill-discovery checks.

**Spec:** `docs/superpowers/specs/2026-05-24-claude-skills-upgrade-design.md` — read it before starting. The **Corrected Feature Catalog**, **endpoint surface**, and **data-model facts** in the spec are the source of truth; copy facts from there, do not re-derive.

**Note on this plan's task shape:** Documentation work has no failing tests. Each task is: (1) grounding read of the real code so claims are accurate, (2) author the file against the spec outline + listed facts, (3) verify via grep/existence, (4) commit. All commits go on branch `feat/enhance-claude-skills` (already checked out). End commit messages with the `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer.

**Skill authoring conventions (apply to every skill file):**
- Start with YAML frontmatter: `---\nname: <kebab-name>\ndescription: <when to invoke this skill>\n---`.
- `name` must exactly match the skill directory name.
- Cross-link sibling skills by name + section heading (never line numbers): e.g. "see `security-analyst` → Posture Scoring Model".
- Keep code/identifier names exact (copy from spec or grounding read).

---

## Task 1: Restructure skill locations + de-duplicate product-manager

**Files:**
- Create dir: `.claude/skills/product-manager/`
- Create dir: `.claude/skills/security-analyst/`
- Create dir: `.claude/skills/prompt-engineer/`
- Create dir: `apps/frontend/.claude/skills/design-system/`
- Create dir: `apps/backend/.claude/skills/ai-jobs-engineer/`
- Delete: `apps/frontend/.claude/skills/product-manager/` (entire dir)
- Delete: `apps/backend/.claude/skills/product-manager/` (entire dir)

- [ ] **Step 1: Snapshot current skill tree**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
find . -path '*/.claude/skills/*' -name 'SKILL.md' -not -path '*/node_modules/*' | sort
```
Expected: the 4 current SKILL.md files (frontend product-manager, frontend frontend-engineer, backend product-manager, backend backend-engineer).

- [ ] **Step 2: Create the new skill directories**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
mkdir -p .claude/skills/product-manager .claude/skills/security-analyst .claude/skills/prompt-engineer apps/frontend/.claude/skills/design-system apps/backend/.claude/skills/ai-jobs-engineer
```

- [ ] **Step 3: Delete the two duplicate product-manager skills**

The root copy (Task 2) replaces them. Run:
```bash
cd /Users/sunil/Development/github/layerssec
git rm -r apps/frontend/.claude/skills/product-manager apps/backend/.claude/skills/product-manager
```
Expected: both `SKILL.md` files staged for deletion.

- [ ] **Step 4: Verify the directory scaffold**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
ls -d .claude/skills/* apps/frontend/.claude/skills/* apps/backend/.claude/skills/*
```
Expected: `product-manager`, `security-analyst`, `prompt-engineer` under root; `frontend-engineer`, `design-system` under frontend; `backend-engineer`, `ai-jobs-engineer` under backend. No `product-manager` under either app.

- [ ] **Step 5: Commit**

```bash
cd /Users/sunil/Development/github/layerssec
git add -A .claude apps/frontend/.claude apps/backend/.claude
git commit -m "chore: scaffold tiered skill layout; remove duplicate product-manager

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Write root `product-manager` skill (rewrite)

**Files:**
- Create: `.claude/skills/product-manager/SKILL.md`

Source material: the old PM skill body (preserved in git history at `f2ad532:apps/backend/.claude/skills/product-manager/SKILL.md`) for the reusable knowledge base; spec sections **New Positioning** and **Corrected Feature Catalog** for the changed parts.

- [ ] **Step 1: Recover the old PM skill body for reuse**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
git show HEAD~1:apps/backend/.claude/skills/product-manager/SKILL.md > /tmp/old-pm.md 2>/dev/null || git show f2ad532:apps/backend/.claude/skills/product-manager/SKILL.md > /tmp/old-pm.md
wc -l /tmp/old-pm.md
```
Expected: the ~274-line old skill. Reuse from it verbatim: CISSP 8-domain table, STRIDE per-element tables, frameworks comparison, compliance mapping, competitive intel, PRD template, "How to think as PM". **Discard** the "Current State (PRDs Shipped)" / "Unshipped PRDs 5/6/7" tables and the "code verification moat" language.

- [ ] **Step 2: Write the new SKILL.md**

Frontmatter `name: product-manager`, `description:` (keep close to old: "Super Product Manager for Layers with deep cybersecurity expertise … Invoke for PRDs, security feature reviews, competitive analysis, feature-gap analysis, compliance mapping").

Body sections in order:
1. **Persona** — principal PM + security strategist (keep from old).
2. **Dual Mandate** — primary ICP dev/eng teams, secondary enterprise CISO/GRC (keep from old).
3. **Positioning — the 3-pillar moat** (NEW, from spec): living AI security analysis + air-gap/BYO-AI + visual attack-path simulation; one paragraph each on why no competitor does all three.
4. **Product Context — Feature Catalog** — paste the 12-row Corrected Feature Catalog from the spec. No PRD shipped/unshipped tables.
5. **Cybersecurity Knowledge Base** — for STRIDE/CISSP/compliance detail, **link to `security-analyst`** rather than duplicating; keep only the compliance-framework-mapping table and frameworks-comparison table here (PM-facing), and a one-line pointer for the per-element STRIDE detail.
6. **Competitive Intelligence** — keep the table; update the "Layers's Edge" column to reference the 3 pillars; keep the positioning summary sentence but reword off "code verification" onto the 3 pillars.
7. **PRD Template** — keep verbatim.
8. **How to Think as This PM** — keep the "before writing a PRD / before reviewing a feature / competitive positioning" checklists; replace the two questions that assume the code-scan moat (the PRD 6/7 integration-path question and the "deepens code verification moat" line) with: "Does this strengthen one of the 3 pillars (living analysis / air-gap / attack-sim)?"
9. **Forward Roadmap Candidates** (reframed): LINDDUN privacy mode, MITRE ATT&CK mapping, ISO/SOC2 control-mapping per threat, threat-model diff view, multi-user collaboration. Label clearly as *candidates, not commitments*. Do **not** list GitHub/code-scan/PR-webhook as the north star.

- [ ] **Step 3: Verify no dead-moat language and frontmatter present**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
head -8 .claude/skills/product-manager/SKILL.md
grep -niE 'deepest moat|code verification moat|PRD 6|PRD 7|north star' .claude/skills/product-manager/SKILL.md
```
Expected: frontmatter shows `name: product-manager`. The grep returns **nothing** (no dead-moat phrasing). If "code scanning" appears, it must only be inside the competitive-intel table as a competitor capability, never as Layers' strategy.

- [ ] **Step 4: Commit**

```bash
cd /Users/sunil/Development/github/layerssec
git add .claude/skills/product-manager/SKILL.md
git commit -m "docs(skills): rewrite product-manager — 3-pillar moat, current catalog

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Write root `security-analyst` skill (NEW)

**Files:**
- Create: `.claude/skills/security-analyst/SKILL.md`
- Read for grounding: `apps/backend/src/ai/prompts/threat-analysis-prompt.ts`, `apps/backend/src/ai/prompts/posture-score-prompt.ts`, `apps/backend/src/ai/prompts/attack-mind-prompt.ts`, `apps/backend/src/jobs/processors/posture-score.processor.ts`

- [ ] **Step 1: Grounding read**

Run:
```bash
cd /Users/sunil/Development/github/layerssec/apps/backend/src
sed -n '1,80p' ai/prompts/posture-score-prompt.ts
sed -n '1,60p' ai/prompts/attack-mind-prompt.ts
grep -nE 'PENALTY|CRITICAL|HIGH|MEDIUM|rawLlmScore|threatPenalty|layerScore' jobs/processors/posture-score.processor.ts
```
Capture: the exact 5 posture dimensions, the penalty constants in code, and how attack-mind uses an entry-point node. These must match what you write.

- [ ] **Step 2: Write the SKILL.md**

Frontmatter `name: security-analyst`, `description:` "Domain authority for Layers' security analysis — STRIDE per-element, posture scoring model, attack-path simulation, threat-intel synthesis, context-aware analysis. Invoke when implementing, reviewing, or tuning any threat/posture/attack/intel feature."

Body sections:
1. **Role** — the security-domain brain shared by PM and engineering skills.
2. **STRIDE Per-Element** — paste the 5 per-element question tables from the old PM skill (process / data store / data flow / trust-boundary crossing / external entity) + the trust-boundary auto-elevation rule.
3. **Context-Aware STRIDE** — how analysis differs by diagram context (webapp / backend / LLM-app / cloud infra); reference that the prompt selects per-element questions by node/edge type.
4. **Posture Scoring Model** (authoritative copy): 5 CISSP dimensions (Attack Surface, Identity Posture, Data Protection, Network Segmentation, Resilience & Monitoring); two-phase scoring — Phase 1 LLM structural 0–100, Phase 2 deterministic penalty `penalty = CRITICAL×4 + HIGH×2 + MEDIUM×0.5`, `final = max(0, llm − penalty)`; constants `{ CRITICAL: 4, HIGH: 2, MEDIUM: 0.5, LOW: 0 }`; why deterministic (anchoring bias); per-layer `layerScores`; `useExtended` mode; fields `score` / `rawLlmScore` / `threatPenalty`. Note: `ai-jobs-engineer` and backend `CLAUDE.md` link here.
5. **Attack Simulation** — reasoning model: entry-point node → reachable paths → exploit chain across trust boundaries; output saved as `AttackSimulation` (`entryPointNodeId`, `content`); rendered by `AttackPathOverlay`.
6. **Threat Intel Synthesis** — what `/ai/intel-synthesis` + `/intel-report` produce from the posture + threat set.
7. **Cross-links** — `prompt-engineer` for the prompt wording, `ai-jobs-engineer` for async execution, `product-manager` for positioning.

- [ ] **Step 3: Verify**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
head -5 .claude/skills/security-analyst/SKILL.md
grep -nE 'CRITICAL.{0,4}4|HIGH.{0,4}2|MEDIUM.{0,4}0.5' .claude/skills/security-analyst/SKILL.md
```
Expected: frontmatter `name: security-analyst`; penalty formula present and matching the code from Step 1.

- [ ] **Step 4: Commit**

```bash
cd /Users/sunil/Development/github/layerssec
git add .claude/skills/security-analyst/SKILL.md
git commit -m "docs(skills): add security-analyst — STRIDE, posture, attack-sim, intel

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Write root `prompt-engineer` skill (NEW)

**Files:**
- Create: `.claude/skills/prompt-engineer/SKILL.md`
- Read for grounding: `apps/backend/src/ai/prompts/` (all files), `apps/backend/src/ai/ai.service.ts`, `apps/backend/src/ai/llm.service.ts`

- [ ] **Step 1: Grounding read**

Run:
```bash
cd /Users/sunil/Development/github/layerssec/apps/backend/src
ls ai/prompts
grep -nE 'export (const|function)' ai/prompts/*.ts
grep -nE "DIAGRAM|splitDiagram|json|parse|promptName|LlmCallConfig" ai/ai.service.ts | head -40
grep -nE "promptName|provider|invoke|stream" ai/llm.service.ts | head -40
```
Capture: the exact exported prompt constant/builder names per file, the `---DIAGRAM---` handling, and the `promptName`/logging contract.

- [ ] **Step 2: Write the SKILL.md**

Frontmatter `name: prompt-engineer`, `description:` "Owns Layers' LangChain prompt library and AI output protocols. Invoke when adding/editing prompts, changing diagram-JSON extraction, or working across the 4 AI providers."

Body sections:
1. **Prompt Library Map** — table: file → exported constant/builder → purpose, for every file in `ai/prompts/` (generate, refine, suggest, eval/QA, chat, contextual, layers-system, threat-analysis, posture-score, attack-mind, declutter, system). Use exact names from Step 1.
2. **Provider-Agnostic Prompting** — 4 providers (ANTHROPIC/OPENAI/OLLAMA/REPLICATE); prompts must avoid provider-specific syntax; `LlmService.invoke(system, user, config)` is the single entry point.
3. **Diagram-JSON Extraction Protocol** — `---DIAGRAM---` separator is primary; fallback = last ```` ```json ```` block parsing to `{ nodes[], edges[] }`; both layers always implemented (backend `ai.service.ts` + frontend `splitDiagramContent`).
4. **Prompt Logging Rules** — never log system or user prompt content; log constant name + char count; always pass `promptName` in `LlmCallConfig`; `[LLM] START/DONE/STREAM` lines.
5. **Streaming vs Structured Output** — when a prompt streams (chat/eval/threat-stream) vs returns structured JSON for a job processor.
6. **Cross-links** — `security-analyst` for the domain content the security prompts encode; `ai-jobs-engineer` for how prompts run inside processors.

- [ ] **Step 3: Verify**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
head -5 .claude/skills/prompt-engineer/SKILL.md
grep -c '\-\-\-DIAGRAM\-\-\-' .claude/skills/prompt-engineer/SKILL.md
```
Expected: frontmatter `name: prompt-engineer`; `---DIAGRAM---` documented (count ≥ 1).

- [ ] **Step 4: Commit**

```bash
cd /Users/sunil/Development/github/layerssec
git add .claude/skills/prompt-engineer/SKILL.md
git commit -m "docs(skills): add prompt-engineer — prompt library + extraction protocol

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Refresh `frontend-engineer` skill

**Files:**
- Modify: `apps/frontend/.claude/skills/frontend-engineer/SKILL.md`
- Read for grounding: `apps/frontend/lib/api.ts` (job submit/poll calls), `apps/frontend/components/PostureScorePanel.tsx` or `AttackMindPanel.tsx` (polling pattern), `apps/frontend/lib/pipelineState.ts`

- [ ] **Step 1: Grounding read**

Run:
```bash
cd /Users/sunil/Development/github/layerssec/apps/frontend
grep -nE 'submit|status|poll|EventSource|stream|fetch' lib/api.ts | grep -iE 'job|posture|attack|threat|stream|status' | head -30
grep -nE 'useEffect|setInterval|status|progress|resultRef|poll' components/PostureScorePanel.tsx | head -20
```
Capture: the actual submit→poll→render shape and the api.ts function names so the documented pattern is real.

- [ ] **Step 2: Edit the SKILL.md**

Keep frontmatter `name: frontend-engineer` but fix the description's stale "Next.js 14" → "Next.js 16". Keep Core Expertise + Coding Standards, updating:
- Add to expertise: **async AI job polling** (submit job → poll `:id/status` → render on `COMPLETED` via `resultRef`) alongside SSE streaming; React Flow overlays (`ThreatOverlay`, `AttackPathOverlay`, `DeclutterOverlay`).
- Add a **Patterns** section (moved from CLAUDE.md): refs-for-stale-closure, pure `setState` updaters (Strict-Mode safe), `ExtendedRFInstance` custom methods, cloud-save debounce.
- Keep verification commands (`npx tsc --noEmit`, `npm run build`).
- Add cross-link to `design-system` for UI primitives + the top-bar pattern.

- [ ] **Step 3: Verify**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
grep -nE 'Next\.js 14' apps/frontend/.claude/skills/frontend-engineer/SKILL.md
grep -niE 'job|poll' apps/frontend/.claude/skills/frontend-engineer/SKILL.md | head
```
Expected: first grep returns **nothing** (no stale "Next.js 14"); job-polling is documented.

- [ ] **Step 4: Commit**

```bash
cd /Users/sunil/Development/github/layerssec
git add apps/frontend/.claude/skills/frontend-engineer/SKILL.md
git commit -m "docs(skills): refresh frontend-engineer — Next 16, job polling, overlays

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Write `design-system` skill (NEW)

**Files:**
- Create: `apps/frontend/.claude/skills/design-system/SKILL.md`
- Read for grounding: `apps/frontend/components/ui/` (list), `apps/frontend/components/AppShell.tsx`, `apps/frontend/app/dev/primitives/`, `apps/frontend/lib/threatBadges.ts`, `apps/frontend/lib/projectBadges.ts`

- [ ] **Step 1: Grounding read**

Run:
```bash
cd /Users/sunil/Development/github/layerssec/apps/frontend
ls components/ui
find app/dev/primitives -type f
grep -nE 'export' lib/threatBadges.ts lib/projectBadges.ts | head -30
grep -nE 'h-9|bg-slate-50|HomeSidebar|children' components/AppShell.tsx | head
```
Capture: the real UI primitive filenames, badge exports, and shell structure.

- [ ] **Step 2: Write the SKILL.md**

Frontmatter `name: design-system`, `description:` "Layers UI consistency — components/ui primitives, AppShell/nav, the secondary-page top-bar pattern, theme/dark-mode, badge conventions. Invoke when building or restyling any UI surface."

Body sections:
1. **UI Primitives** — table of `components/ui/*` with one-line purpose each (from Step 1); the `app/dev/primitives` gallery as the live reference.
2. **App Shell & Navigation** — `AppShell`, `HomeSidebar`, route structure (`home`, `activity`, `intel`, `trust-map`, `threats`, `ai-history`, `diff`).
3. **Secondary-Page Top-Bar Pattern** — move the full `h-9` header pattern block out of frontend CLAUDE.md to here, verbatim (this becomes its authoritative home).
4. **Theme / Dark Mode** — `ThemeProvider`, FOUC inline script, `dark:` variants, theme cycle.
5. **Badge Conventions** — `threatBadges` (severity/STRIDE/status colors) and `projectBadges`.
6. **Panel Docking** — right-docked panels + ⌘ toggles (`ThreatModelPanel`, `PostureScorePanel`, `AttackMindPanel`, `AIChatPanel`).

- [ ] **Step 3: Verify**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
head -5 apps/frontend/.claude/skills/design-system/SKILL.md
grep -nE 'h-9|top bar|top-bar' apps/frontend/.claude/skills/design-system/SKILL.md | head
```
Expected: frontmatter `name: design-system`; top-bar pattern present.

- [ ] **Step 4: Commit**

```bash
cd /Users/sunil/Development/github/layerssec
git add apps/frontend/.claude/skills/design-system/SKILL.md
git commit -m "docs(skills): add design-system — primitives, shell, top-bar, theme

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Refresh `backend-engineer` skill

**Files:**
- Modify: `apps/backend/.claude/skills/backend-engineer/SKILL.md`
- Read for grounding: `apps/backend/src/encryption/` (list + service), one controller for the ownership pattern (e.g. `apps/backend/src/threat/threat.controller.ts`)

- [ ] **Step 1: Grounding read**

Run:
```bash
cd /Users/sunil/Development/github/layerssec/apps/backend/src
ls encryption
grep -nE 'aes-256-gcm|createCipheriv|encrypt|decrypt|iv|authTag' encryption/*.ts
grep -nE 'ownerId|CurrentUser|ensureOwnership|UseGuards' threat/threat.controller.ts | head
```
Capture: the encryption algorithm + format and the ownership-guard idiom.

- [ ] **Step 2: Edit the SKILL.md**

Keep frontmatter `name: backend-engineer` + the security-first persona. Update body:
- **Core Expertise** — add: 4-provider LLM abstraction; BullMQ async jobs (link to `ai-jobs-engineer`); encryption module.
- **Security** — keep BOLA/IDOR/ownership-on-every-endpoint + prompt-injection; add **encryption rules**: AES-256-GCM (`iv:authTag:ciphertext` base64), never expose plaintext keys in responses, never log them.
- **Gotchas (pointers, not full text)** — one line each with cross-link: PDFKit binary-response quirk (full text stays in backend CLAUDE.md or this skill — pick one and link), posture penalty rule → `security-analyst` → Posture Scoring Model.
- Fix description if it says "Anthropic Claude API" only → "multi-provider LLM (Anthropic/OpenAI/Ollama/Replicate)".

- [ ] **Step 3: Verify**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
grep -niE 'aes-256-gcm|never (log|expose)' apps/backend/.claude/skills/backend-engineer/SKILL.md
grep -niE 'anthropic claude api' apps/backend/.claude/skills/backend-engineer/SKILL.md
```
Expected: first grep matches (encryption rules present); second returns nothing (no "Anthropic-only" framing left).

- [ ] **Step 4: Commit**

```bash
cd /Users/sunil/Development/github/layerssec
git add apps/backend/.claude/skills/backend-engineer/SKILL.md
git commit -m "docs(skills): refresh backend-engineer — 4 providers, encryption, jobs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Write `ai-jobs-engineer` skill (NEW)

**Files:**
- Create: `apps/backend/.claude/skills/ai-jobs-engineer/SKILL.md`
- Read for grounding: `apps/backend/src/jobs/` (all files), `apps/backend/src/ai/llm.service.ts`, `apps/backend/src/user-settings/`

- [ ] **Step 1: Grounding read**

Run:
```bash
cd /Users/sunil/Development/github/layerssec/apps/backend/src
sed -n '1,60p' jobs/queues.ts
grep -nE 'Queue|Worker|Processor|add\(|progress|updateProgress|resultRef|status' jobs/jobs.service.ts jobs/processors/*.ts | head -40
grep -nE 'provider|model|decrypt|UserAiSettings|ANTHROPIC|OPENAI|OLLAMA|REPLICATE' ai/llm.service.ts | head -30
ls user-settings
```
Capture: queue names, processor registration, the AiJob lifecycle transitions, and how `LlmService` picks provider/model/key from `UserAiSettings`.

- [ ] **Step 2: Write the SKILL.md**

Frontmatter `name: ai-jobs-engineer`, `description:` "Async AI job pipeline for Layers — BullMQ queues, processors, AiJob lifecycle, provider selection, BYO-key. Invoke when adding/changing background AI jobs, the job API, or LLM provider/settings wiring."

Body sections:
1. **Architecture** — BullMQ + Redis (`ioredis`); `jobs/queues.ts` queue defs; 3 processors (`threat-analysis`, `posture-score`, `attack-simulation`) + `DECLUTTER` job type.
2. **AiJob Lifecycle** — `PENDING → RUNNING → COMPLETED | FAILED | CANCELLED`; `progress` (0–100), `resultRef` (id of resulting ThreatModel/PostureScore/AttackSimulation), `errorMessage`; API: `submit` endpoints, `/jobs/:id/status` polling, `/jobs/:id/cancel`, `/jobs/activity`.
3. **Submit vs Stream** — when to enqueue a job vs SSE-stream (long/structured → job; conversational → stream).
4. **Provider Selection & BYO-Key** — `LlmService` reads `UserAiSettings` (provider, model, `ollamaBaseUrl`/`openAiBaseUrl`, decrypted key via encryption module); 4 providers; air-gap path = Ollama, no key.
5. **Posture Penalty in the Processor** — `posture-score.processor` applies the deterministic penalty after the LLM returns; **authoritative formula lives in `security-analyst` → Posture Scoring Model**; restate the constants here for the processor's sake and link.
6. **Logging** — reuse the AI logging contract (link `prompt-engineer`).

- [ ] **Step 3: Verify**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
head -5 apps/backend/.claude/skills/ai-jobs-engineer/SKILL.md
grep -nE 'PENDING|RUNNING|COMPLETED|FAILED|CANCELLED' apps/backend/.claude/skills/ai-jobs-engineer/SKILL.md
```
Expected: frontmatter `name: ai-jobs-engineer`; full lifecycle documented.

- [ ] **Step 4: Commit**

```bash
cd /Users/sunil/Development/github/layerssec
git add apps/backend/.claude/skills/ai-jobs-engineer/SKILL.md
git commit -m "docs(skills): add ai-jobs-engineer — BullMQ, AiJob lifecycle, BYO-key

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Slim + refresh root `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write the new root CLAUDE.md**

Replace the body with orientation only:
1. **What Layers is** — one paragraph: AI-driven security threat-modeling on architecture diagrams.
2. **Monorepo layout** — `apps/frontend` (Next.js), `apps/backend` (NestJS), `assets/`, `docs/`.
3. **Shared infra** — Postgres (Supabase prod / local dev), Redis (BullMQ), ChromaDB (RAG), Supabase Storage (thumbnails).
4. **Feature catalog at a glance** — paste the 12-row Corrected Feature Catalog from the spec.
5. **Where deeper docs live** — `apps/*/CLAUDE.md` for per-app orientation; skills at `.claude/skills/` (root: product-manager, security-analyst, prompt-engineer; frontend: frontend-engineer, design-system; backend: backend-engineer, ai-jobs-engineer).
6. **Running apps** — keep the existing frontend/backend run commands.

- [ ] **Step 2: Verify it shrank and points to skills**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
wc -l CLAUDE.md
grep -nE 'security-analyst|ai-jobs-engineer|prompt-engineer|design-system' CLAUDE.md
```
Expected: file is short (orientation only); the new skills are referenced.

- [ ] **Step 3: Commit**

```bash
cd /Users/sunil/Development/github/layerssec
git add CLAUDE.md
git commit -m "docs: slim root CLAUDE.md to orientation + feature catalog

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Slim + refresh frontend `CLAUDE.md`

**Files:**
- Modify: `apps/frontend/CLAUDE.md`
- Read for grounding: `apps/frontend/app/` route tree, `apps/frontend/components/` list

- [ ] **Step 1: Grounding read**

Run:
```bash
cd /Users/sunil/Development/github/layerssec/apps/frontend
find app -type d -not -path '*/node_modules/*' | sort
ls components | sort
```
Confirm the route + component inventory before writing.

- [ ] **Step 2: Write the new frontend CLAUDE.md**

Orientation only:
1. **Stack** — Next 16 App Router, React 18, React Flow 11, Tailwind v3 (`darkMode: 'class'`), cloud storage via `lib/api.ts`, `lucide-react`.
2. **Route map** — `home`, `activity`, `intel`, `trust-map`, `projects/[projectId]`, `projects/[projectId]/threats[/threatId]`, `ai-history`, `diff`, `dev/primitives`, `login`.
3. **Where things live** — short table: canvas (`DiagramCanvas`/`DiagramPage`), nodes (`components/nodes`), overlays, panels, security pages (`PostureScorePanel`/`AttackMindPanel`/`AttackPathOverlay`/`SecurityIntelPage`/`TrustMapPage`), shell (`AppShell`/`HomeSidebar`), UI primitives (`components/ui`), key `lib/*` (`api`, `layerStore`, `canvasContext`, `pipelineState`, `trustMap`, `onboardingStore`).
4. **Deep detail → skills** — patterns → `frontend-engineer`; UI/shell/top-bar/theme → `design-system`. Remove the big inline file-map and the top-bar code block (now in `design-system`).
5. **Verification** — `npx tsc --noEmit`, `npm run build`.

- [ ] **Step 3: Verify the top-bar block moved out and skills referenced**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
grep -cE 'Secondary Page Top Bar Pattern' apps/frontend/CLAUDE.md
grep -nE 'frontend-engineer|design-system' apps/frontend/CLAUDE.md
wc -l apps/frontend/CLAUDE.md
```
Expected: top-bar pattern count is 0 (moved to design-system); both frontend skills referenced; file meaningfully shorter than the original ~231 lines.

- [ ] **Step 4: Commit**

```bash
cd /Users/sunil/Development/github/layerssec
git add apps/frontend/CLAUDE.md
git commit -m "docs: slim frontend CLAUDE.md; relocate patterns to skills

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Slim + refresh backend `CLAUDE.md`

**Files:**
- Modify: `apps/backend/CLAUDE.md`

Use the spec's **verified endpoint surface** and **data-model facts** verbatim — they were extracted from `schema.prisma` and the controllers.

- [ ] **Step 1: Write the new backend CLAUDE.md**

Orientation only:
1. **Stack** — NestJS 10, Prisma 5 + Postgres, ChromaDB (RAG), Redis + BullMQ (jobs), JWT (access + refresh-token families), bcrypt, `class-validator`, LangChain multi-provider (`@langchain/anthropic|openai|ollama`), port 4000.
2. **Modules** — list all: `ai`, `auth`, `chat`, `common`, `diagrams`, `encryption`, `jobs`, `onboarding`, `prisma`, `projects`, `rag`, `threat`, `user-settings`, `users`. One line each.
3. **Data model summary** — the spec's "Key data-model facts" block (4 providers, AiJob enums, `ThreatStatus.IDENTIFIED`, PostureScore fields incl `layerScores`/`useExtended`, AttackSimulation, UserAiSettings encrypted keys).
4. **Endpoint surface** — paste the spec's verified endpoint list (ai / jobs / threat / user-settings / onboarding / auth / projects / diagrams).
5. **Gotchas (one-liners + links)** — posture penalty → `security-analyst`; BullMQ/job lifecycle → `ai-jobs-engineer`; prompt logging + `---DIAGRAM---` → `prompt-engineer`; encryption → `backend-engineer`. Keep the PDFKit quirk inline (or move to `backend-engineer` and link — be consistent with Task 7's choice).
6. **Dev setup** — keep `createdb`, `db:migrate`, `start:dev`, `db:studio`, env-file notes.

- [ ] **Step 2: Verify accuracy against schema**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
grep -nE 'OPEN' apps/backend/CLAUDE.md
grep -nE 'REPLICATE|OPENAI|OLLAMA|ANTHROPIC' apps/backend/CLAUDE.md
grep -nE 'security-analyst|ai-jobs-engineer|prompt-engineer' apps/backend/CLAUDE.md
```
Expected: no stray `OPEN` status (must be `IDENTIFIED`); all 4 providers listed; skills cross-referenced.

- [ ] **Step 3: Commit**

```bash
cd /Users/sunil/Development/github/layerssec
git add apps/backend/CLAUDE.md
git commit -m "docs: slim backend CLAUDE.md; correct providers, endpoints, model facts

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Final verification sweep

**Files:** none (read-only checks)

- [ ] **Step 1: Confirm exactly 7 skills at the tiered locations**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
find . -path '*/.claude/skills/*/SKILL.md' -not -path '*/node_modules/*' | sort
```
Expected exactly:
```
./.claude/skills/product-manager/SKILL.md
./.claude/skills/prompt-engineer/SKILL.md
./.claude/skills/security-analyst/SKILL.md
./apps/backend/.claude/skills/ai-jobs-engineer/SKILL.md
./apps/backend/.claude/skills/backend-engineer/SKILL.md
./apps/frontend/.claude/skills/design-system/SKILL.md
./apps/frontend/.claude/skills/frontend-engineer/SKILL.md
```
No `product-manager` under either app.

- [ ] **Step 2: Confirm the dead roadmap is gone as strategy across all docs**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
grep -rniE 'deepest moat|code verification moat|PRD 5|PRD 6|PRD 7|north star' .claude apps/*/.claude apps/*/CLAUDE.md CLAUDE.md
```
Expected: no hits. (If "code scanning" appears, confirm by eye it is only a competitor capability in the competitive-intel table, never Layers' strategy.)

- [ ] **Step 3: Confirm every skill has valid frontmatter**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
for f in $(find . -path '*/.claude/skills/*/SKILL.md' -not -path '*/node_modules/*'); do echo "== $f"; head -4 "$f"; done
```
Expected: each starts with `---` / `name:` / `description:` / `---`, and `name` matches its directory.

- [ ] **Step 4: Confirm provider count + ThreatStatus correct everywhere**

Run:
```bash
cd /Users/sunil/Development/github/layerssec
grep -rniE 'anthropic (\+|and) ollama only|only anthropic' . --include=*.md --exclude-dir=node_modules
grep -rnE '\bOPEN\b' apps/backend/CLAUDE.md
```
Expected: both return nothing.

- [ ] **Step 5: Final commit (if any uncommitted doc tweaks remain)**

```bash
cd /Users/sunil/Development/github/layerssec
git status --short
# only if doc files are dirty:
git add -A '*.md' '*/SKILL.md' && git commit -m "docs: final consistency pass on skills + CLAUDE.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>" || echo "nothing to commit"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** All 6 goals mapped — restructure/dedup (T1), product-manager rewrite (T2), security-analyst (T3), prompt-engineer (T4), frontend-engineer (T5), design-system (T6), backend-engineer (T7), ai-jobs-engineer (T8), 3 CLAUDE.md (T9–T11), verification incl. acceptance criteria (T12). Every spec acceptance-criterion has a verifying grep in T2/T5/T7/T9/T10/T11/T12.

**Placeholder scan:** No TBD/TODO. Each task names exact files, exact grounding-read commands, exact verify commands with expected output. Skill bodies are specified as section outlines + the exact facts/identifiers to include (the pragmatic unit for prose authoring) plus a grounding read to fill remaining detail — not vague "write the skill".

**Type/name consistency:** Skill directory names match frontmatter `name` throughout. Cross-links use skill-name + section-heading. Posture penalty formula authored once (T3 `security-analyst`), referenced from T7/T8/T11. Top-bar pattern authored once (T6 `design-system`), removed from frontend CLAUDE.md (T10). PDFKit gotcha placement flagged to keep consistent between T7 and T11.
