# Multi-Flow Projects — Design Spec

**Date:** 2026-06-14
**Status:** Draft — awaiting user review
**Scope:** Shift Layers from "project = 1 architecture diagram" to "project = many DFD flows (login, checkout, etc.)". Hide drill-down. Project-level rollups for threats and intel; per-diagram posture + attack sim.

---

## 1. Background

**Today**
- `Project` has exactly one architecture diagram (system → container → component drill-down).
- Analyses (`ThreatModel`, `PostureScore`, `AttackSimulation`) are already keyed by `diagramId + diagramVersion` in the schema, but UX treats them as project-level.
- Drill-down is a first-class canvas feature.

**Target**
- `Project` has many `Diagram` rows, each representing one application flow (DFD style).
- Each diagram keeps its own versioning (git-style checkout / publish — unchanged).
- Drill-down is hidden in UI; data + code path preserved for later revival.
- Analyses gain project-level rollups where it makes sense.

---

## 2. Decisions log

| # | Question | Choice |
|---|----------|--------|
| Q1 | Rollup scope | Threats = aggregate + filter; Posture = per-diagram + weighted project rollup; Attack sim = per-diagram only; Intel = project-level |
| Q2 | Project metadata shape | Hybrid: typed columns (`techStack`, `environment`, `compliance`) + free `notes` |
| Q3 | Diagram type | Keep `DiagramType` enum, hide from UI |
| Q4 | Drill-down handling | Hide UI, keep data + code path (feature-flagged) |
| Q5 | Existing-project migration | Keep as-is, default name "Main Flow" |
| Q6 | Navigation | Split view: left rail diagrams, right pane canvas |
| Q7 | Project-level surfaces | Left rail "Project" item swaps right pane to overview |

---

## 3. Data model

### 3.1 Project — additive columns

```prisma
model Project {
  // existing fields unchanged
  techStack    String[]    @default([])
  environment  Environment?
  compliance   String[]    @default([])   // whitelist: SOC2|ISO27001|PCI|HIPAA|GDPR|FedRAMP
  notes        String?     @db.Text
  repoUrl      String?     @map("repo_url")
}

enum Environment {
  DEV
  STAGING
  PROD
}
```

### 3.2 Diagram — no schema change

- `DiagramType` enum kept; UI hides type selector.
- `canvasData.layers` structure preserved; drill-down code-paths gated by `ENABLE_DRILLDOWN_UI` flag (default off).
- Backfill: rows where `name IS NULL OR name = ''` → `'Main Flow'`.

### 3.3 ThreatModel / PostureScore / AttackSimulation — no schema change

Already keyed by `projectId + diagramId + diagramVersion`. Posture rollup is deterministic (no new row needed; computed on read).

### 3.4 ProjectIntelReport — new model

Add reverse relation `intelReports ProjectIntelReport[]` to `Project`.

Replaces the in-flight intel response with a persisted, history-listable record.

```prisma
model ProjectIntelReport {
  id           String   @id @default(uuid()) @db.Uuid
  projectId    String   @map("project_id") @db.Uuid
  snapshotData Json     @map("snapshot_data") // { project: {...}, diagrams: [{ id, name, version, threatSummary, postureScore }] }
  content      String   @db.Text
  diagramRefs  Json     @map("diagram_refs")  // [{ diagramId, version }]
  generatedBy  String   @map("generated_by") @db.Uuid
  generatedAt  DateTime @default(now()) @map("generated_at")
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@map("project_intel_reports")
}
```

### 3.5 ChatMessage — additive

Add nullable `diagramId String? @map("diagram_id")` so chats can be flow-scoped while project-wide chats remain valid.

---

## 4. Navigation / IA

### 4.1 Routes

| Route | Purpose |
|-------|---------|
| `/projects` | Project list — cards show name, env chip, techStack chips, diagram count |
| `/projects/:id` | Split-view shell (default landing) |
| `/projects/:id?view=project` | Deep link to project overview |
| `/projects/:id?diagram=:diagramId` | Deep link to a specific canvas |

### 4.2 Split-view layout

- **Left rail (~260px, fixed):**
  - `Project` item (top, distinct styling, icon: folder)
  - Divider
  - `+ New Flow` button
  - Diagram list — name, last-updated, severity-coloured threat-count badge, posture-grade badge
- **Right pane (flex):** project overview OR canvas, depending on left selection.

### 4.3 Project overview (right pane)

- Header: name, description (inline-editable), tech-stack chips, environment chip, compliance chips, notes (expandable).
- Aggregated widgets:
  - **Threats rollup** — count by severity + STRIDE breakdown across all diagrams; "view all" → threats dashboard route or modal.
  - **Posture rollup** — weighted project score + per-diagram mini-bars; click a bar → opens that diagram's canvas with posture panel open.
  - **Intel report** — latest summary card + Regenerate button + history list.
- Recent activity timeline (publishes, jobs, threat status changes).

### 4.4 Canvas (right pane)

- Existing React Flow canvas.
- Top toolbar: diagram name (inline edit), version dropdown, publish, threat-analysis / posture / attack buttons.
- **Removed in UI:** zoom-into-layer button, layer breadcrumb, "drill down" right-click menu.
- Side panel for per-diagram threats / posture / attack.

### 4.5 New-flow dialog

- Fields: name (required), description (optional).
- Start from:
  - `Blank` — empty canvas.
  - `AI suggest from project metadata` — calls new `/api/ai/suggest-flow` with project metadata + existing diagram names → seeded canvas via `---DIAGRAM---` extraction.

---

## 5. Per-feature scope changes

### 5.1 Threats dashboard (Q1: aggregate + filter)

- Existing `GET /api/projects/:id/threats` already paginates/filters.
- Add query params: `diagramId`, `severity[]`, `stride[]`, `status[]`.
- UI: project-overview widget summarises totals; full dashboard renders inside project overview as an expanded section (no new route) — groups by diagram by default, flat-list toggle.
- PDF report `/threats/report` keeps project scope; add optional `diagramId` query for per-flow report.

### 5.2 Posture score (Q1: per-diagram + weighted project rollup)

- Per-diagram unchanged.
- New: `GET /api/projects/:id/posture-rollup` — reads latest `PostureScore` per diagram, returns:
  ```json
  {
    "projectScore": 78,
    "diagrams": [
      { "diagramId": "...", "name": "Login", "score": 82, "version": 3 },
      { "diagramId": "...", "name": "Checkout", "score": 74, "version": 2 }
    ]
  }
  ```
- v1 weights = equal (mean). Weight configuration is **out of scope**.

### 5.3 Attack sim (Q1: per-diagram only)

- No backend change. Entry-point + content stays per-diagram.
- UI: lives in canvas-view side panel; not surfaced in project overview.

### 5.4 Intel report (Q1: project-level, persisted)

- `POST /api/projects/:id/intel-report` — rewritten payload (see §6.4), persists `ProjectIntelReport`.
- New: `GET /api/projects/:id/intel-reports` (list), `GET /api/intel-reports/:id` (full).
- UI: project-overview card shows latest; modal for full content + history.

### 5.5 Pipeline orchestration

- `GET /api/ai/projects/:projectId/pipeline-status` → moves to `GET /api/diagrams/:diagramId/pipeline-status`.
- Old route stays one release with `Deprecation` header.
- Project overview shows aggregate "X of Y diagrams analysed" indicator.

### 5.6 AI jobs

- No schema change. `AiJob.diagramId` already exists.
- UI: job activity tray groups by diagram within project.

### 5.7 Chat

- Add nullable `ChatMessage.diagramId`.
- Project-scope threads still valid; new flow-scope threads opt in.

---

## 6. AI / prompt impact

### 6.1 `threat-analysis`

- Inputs unchanged (per-diagram diagram JSON).
- Add project context (`techStack`, `compliance`, `environment`) to system prompt for sharper STRIDE output.

### 6.2 `posture-score`

- Inputs unchanged per-diagram.
- Rollup is deterministic (weighted mean); no new LLM call.

### 6.3 `attack-mind`

- Inputs unchanged per-diagram.
- Add project metadata to system prompt.

### 6.4 `intel-synthesis` (rewritten)

- Inputs:
  - Project: `name`, `description`, `techStack`, `environment`, `compliance`, `notes`.
  - Per-diagram summaries: `name`, threat counts by severity, top-5 threats by severity, latest posture score.
- Output sections: threat landscape, sector trends, compliance gaps, top recommendations.
- Token cap: top-20 threats per diagram, truncate beyond; logged in `inputTokens`.

### 6.5 `suggest-flow` (new)

- Inputs: project metadata + names of existing diagrams.
- Output: diagram JSON via `---DIAGRAM---` extraction.

### 6.6 Logging

All new prompts pass `promptName`; no content logging (per `prompt-engineer` rules).

### 6.7 Provider abstraction

No change. All prompts flow through `LlmService`. BYO-key path unchanged.

---

## 7. Migration

### 7.1 DB

- Additive Project columns (nullable / default empty).
- New `Environment` enum.
- New `project_intel_reports` table.
- Nullable `chat_messages.diagram_id`.
- Backfill `diagrams.name` blanks → `'Main Flow'`.
- No destructive ops. No data loss.

### 7.2 Backend

- Project DTOs accept new fields (optional on create/update).
- Validators: `Environment` enum, `compliance` whitelist (`SOC2|ISO27001|PCI|HIPAA|GDPR|FedRAMP`).
- New `PostureRollupService` (deterministic).
- New `IntelReportService` (persists `ProjectIntelReport`).
- New `/api/ai/suggest-flow` endpoint.
- `pipeline-status` route updated; old route returns same payload one release with `Deprecation` header.

### 7.3 Frontend

- `/projects/:id` rewritten as split-view shell (`ProjectShell`, `LeftRailDiagramList`, `ProjectOverviewPane`, `CanvasPane`).
- Old `/projects/:id` direct-to-canvas → redirect to split-view with last-opened diagram preselected.
- Drill-down components (`LayerBreadcrumb`, drill button, layer-zoom logic) gated behind `ENABLE_DRILLDOWN_UI=false`. Code preserved.
- Project metadata edit form (tech stack chips, env select, compliance multi-select, notes textarea).
- New-flow dialog (Blank | AI suggest).

### 7.4 Rollout

- 5–7 PRs, sequenced:
  1. Schema + migration.
  2. Backend Project metadata fields + DTOs/validators.
  3. Backend posture-rollup + intel persistence.
  4. Backend `suggest-flow` + pipeline-status route change.
  5. Frontend split-view shell + project overview.
  6. Frontend canvas changes + drill-down hide flag.
  7. Prompt edits + snapshot tests.
- Feature flag `ENABLE_MULTI_FLOW_UI` (frontend, default on) for quick revert.

---

## 8. Testing

- Backend unit: DTO validators (env enum, compliance whitelist), posture-rollup math.
- Backend integration: 3-diagram project → `posture-rollup` returns expected mean; intel report contains references to all 3 + compliance items.
- Frontend component: split-view selection, new-flow dialog, project metadata form.
- Frontend e2e: create project → add 2 flows → run threat analysis on each → see aggregated dashboard.
- Prompt snapshot tests for `intel-synthesis` and `suggest-flow` with fixture project + diagrams.

---

## 9. Out of scope

- Drill-down removal (hidden only, code preserved).
- Posture weight configuration UI.
- Cross-project rollups.
- Sharing / permissions changes.
- Threat dedup across diagrams (each diagram's threats stay independent).
- Migrating old drill-down layers into separate flows (no auto-split).

---

## 10. Open questions

None — all 7 brainstorming questions resolved.
