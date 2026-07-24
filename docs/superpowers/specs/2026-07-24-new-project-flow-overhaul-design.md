# New Project Flow Overhaul — Design

**Date:** 2026-07-24
**Status:** Approved (pending spec review)
**Area:** `apps/frontend` (new-project wizard) + `apps/backend` (`ai` module)

## Problem

The current new-project experience (`NewProjectChat.tsx` → `POST /api/ai/chat/generate`) has
several UX and correctness gaps:

1. **Framing.** The greeting says "create a Data Flow Diagram (DFD)" but never tells the user that a
   *project* is a new **application** (frontend, backend, or both) and that *diagrams* cover
   individual **features or flows** within it.
2. **Single-shot generation.** One user message produces a full DFD immediately. The user gives
   project name + system description + flow scope all at once. No chance to refine before generation.
3. **Over-dense, over-assumed first diagram.** The prompt forces a concrete tech stack per node
   (`PostgreSQL 15`, `Kong Gateway`), 3–4 trust boundaries, and rich descriptions — assumptions the
   user never made. The initial diagram is too heavy.
4. **No guardrail.** Non-software input still produces a diagram. The tool should decline input that
   isn't a software system.
5. **Preview too small / not interactive.** The inline preview is a fixed 240px, pan/zoom only, with
   no way to maximize.
6. **Thin backend logging.** Generation logs `promptName` + tokens + duration only. Debugging the
   generation path is hard.

## Goals

- Reframe project vs. diagram for the user.
- Collect project name + description first, then run a conversational DFD builder.
- Generate a **minimal** first DFD with **no assumed tech stack**, ask-first when unclear.
- Decline non-software input on **every** turn.
- Add a fullscreen, pan/zoom preview modal.
- Add info-level lifecycle logging (with opt-in truncated content) for the generation path.
- Log the **entire** conversation to AI history.

## Non-Goals

- No change to the in-canvas `chatGenerate` path (used elsewhere for layer/flow generation).
- No editing inside the preview modal — editing happens after opening the real project.
- No schema migration (existing `AiInteraction` + `ChatMessage` models suffice).

## Architecture

Two-phase new-project experience, both rendered inside the reworked `NewProjectChat` component.

### Phase A — Project form

Small form, not chat:

- **Project name** (required).
- **Description** (optional, multi-line).
- Helper copy: *"A project is a new application — frontend, backend, or both. Diagrams cover
  individual features or flows within it."*
- On submit → `apiCreateProject(name, description)` → returns `projectId`. **The project is created
  up front**, before the DFD conversation. Trade-off: an abandoned form leaves an empty project.
  Accepted — it lets every subsequent chat turn attach to `AiInteraction` (AI history) and
  `ChatMessage` (per-project chat), and the user always leaves with a project they can open.

### Phase B — Conversational DFD builder

Reuses the existing chat thread UI (`ChatBubble`, `ThinkingDots`, input bar). Multi-turn.

New endpoint: **`POST /api/ai/new-project/converse`**

Request:
```
{ projectId: string, messages: { role: 'user' | 'ai', text: string }[] }
```

The full running conversation is sent each turn (stateless server; the model sees prior turns).

Response — exactly one `mode`:

```
{ mode: "refuse", message: string }                       // non-software / off-topic
{ mode: "ask",    message: string }                       // clarifying question
{ mode: "generate", message: string, diagramName: string,
                    nodes: [...], edges: [...],
                    oversizeWarning?: { reason, suggestedSplits } }
```

Behaviour, enforced by the new prompt:

- **Refuse (every turn).** If the latest user input does not describe a software system/flow, return
  `mode: "refuse"` with a short decline explaining the tool only models software applications. No
  diagram. Chat continues. Applies mid-conversation too, not just the first turn.
- **Ask-first.** If the software input is under-specified, return `mode: "ask"` with a minimal
  clarifying question. The model asks the *fewest* questions needed.
- **Generate (minimal).** When the model has enough, return `mode: "generate"` with the smallest
  correct DFD:
  - **No assumed tech stack** — the `technology` field is omitted (do not guess `PostgreSQL 15`).
  - **Minimal trust boundaries** — only what STRIDE strictly needs (typically Internet + Internal).
  - Generic labels (`Auth Service`, not `Kong Gateway`).
  - Edge labels convey data + transport security where a boundary is crossed.
  - `oversizeWarning` only when the (rare, for a minimal DFD) count exceeds 25.
- On `generate`, the frontend calls `apiCreateDiagram(projectId, diagramName, canvasData)` and renders
  the preview card.

New prompt: **`NEW_PROJECT_CONVERSE_PROMPT`** (`apps/backend/src/ai/prompts/`). Derived from
`LAYERS_SYSTEM_PROMPT` but: adds the `mode` envelope + refusal rule, drops the mandatory-tech-stack /
mandatory-3-4-boundaries directives, mandates minimalism and no tech guessing. Output is a single
JSON object with the `mode` field.

### Preview + maximize

- Preview card (post-`generate`) gains an **expand** button.
- New component **`DiagramPreviewModal`** — near-fullscreen overlay rendering `MiniDiagramPreview`
  with `fitView` + pan/zoom, **read-only**, closable via X button and `Esc`.
- Inline card stays; modal is additive.

## Components & Files

### Frontend (`apps/frontend`)

- `components/NewProjectChat.tsx` — rework into Phase A (form) + Phase B (converse chat loop). Replace
  the single `apiChatGenerate` call with the form-submit → project-create → converse-loop flow.
- `components/DiagramPreviewModal.tsx` — **new**. Fullscreen read-only preview (pan/zoom, Esc/X).
- `lib/api.ts` — **new** `apiConverse({ projectId, messages })`; keep `apiChatGenerate` unchanged.

### Backend (`apps/backend/src/ai`)

- `ai.controller.ts` — **new** `@Post('new-project/converse')` route → `aiService.converse(...)`.
- `ai.service.ts` — **new** `converse()` method. Extract the shared diagram post-processing
  (position sanitize, oversize validation, node/edge coercion) from `chatGenerate()` into a private
  helper reused by both. Add lifecycle logging (see below). Write `AiInteraction` per turn; write
  `ChatMessage` (projectId is always known now).
- `ai/dto/converse.dto.ts` — **new** DTO (`projectId`, `messages[]`) with `class-validator`.
- `ai/prompts/new-project-converse-prompt.ts` — **new** `NEW_PROJECT_CONVERSE_PROMPT`.

## Data Flow

```
Phase A: form submit
  → apiCreateProject(name, description)  → projectId

Phase B: each user message
  → apiConverse({ projectId, messages })
      → LLM (NEW_PROJECT_CONVERSE_PROMPT)
      → mode = refuse | ask | generate
      → AiInteraction row written (turn logged to AI history)
      → ChatMessage rows written (user + assistant)
  → mode === 'generate':
      → apiCreateDiagram(projectId, diagramName, canvasData { layers, navStack })
      → render preview card
      → expand → DiagramPreviewModal
```

## Logging

In `converse()`, info-level lifecycle logs (no user content by default):

```
[new-project] turn=<n> userId=<id> projectId=<id> received
[new-project] mode=<refuse|ask|generate> turn=<n>
[new-project] parsed nodes=<n> edges=<n> boundaries=<n>   (generate only)
[new-project] parse-failed turn=<n> err=<...>             (on failure)
[new-project] done turn=<n> durationMs=<n>
```

When `AI_DEBUG=true`: additionally log a truncated user input snippet, first 120 chars:
`[new-project] input(120)="..."`. Off by default — preserves the no-prompt-content privacy rule.

`LlmService`'s existing `[LLM] START/DONE` logs are unchanged.

## Error Handling

- **LLM failure / non-JSON:** chat shows a graceful error; the project already exists so the user can
  open it and build manually. Treat unparseable output as an `ask` retry where reasonable.
- **Refuse:** decline message rendered, no diagram, chat stays open.
- **Project create failure (Phase A):** surface the error on the form; do not advance to chat.
- **Diagram create failure (post-generate):** show error message; project still openable.

## Testing

Backend (`ai.service` unit tests):
- `converse()` parses each `mode` (refuse / ask / generate) correctly.
- Off-topic / non-software input yields `mode: "refuse"` (mock LLM output).
- `generate` output contains no `technology` field on nodes.
- Shared post-processing helper still sanitizes missing positions (regression for `chatGenerate`).

Frontend:
- `npx tsc --noEmit` → 0 errors; `npm run build` succeeds.
- Manual: form → create project → chat asks clarifying Q → generate minimal DFD → expand modal
  (pan/zoom, Esc closes) → open project. Verify non-software input is declined.
- Verify conversation turns appear on the AI history page.

## Open Questions

None. Decisions locked:
- Flow shape: **form (name + description) → open chat**, AI decides readiness.
- First DFD: **ask-first, minimal, no tech stack**.
- Guardrail: **in-prompt refusal, every turn**.
- Preview: **fullscreen modal, pan/zoom, read-only**.
- Logging: **lifecycle metadata + truncated content behind `AI_DEBUG`**.
- Project creation: **on form submit, before the DFD conversation**.
- `chatGenerate`: **kept intact**; new-project flow uses the new `converse` endpoint.
