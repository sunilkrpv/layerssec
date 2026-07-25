# New Project Flow Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-shot new-project DFD generator with a two-phase flow — a project form (name + description) followed by a conversational DFD builder that asks-first, generates a minimal tech-stack-free DFD, refuses non-software input every turn, offers a fullscreen preview modal, and logs the whole conversation to AI history.

**Architecture:** New backend endpoint `POST /api/ai/new-project/converse` returns one of three modes (`refuse` / `ask` / `generate`) per turn, driven by a new `NEW_PROJECT_CONVERSE_PROMPT`. Pure post-processing helpers are extracted so both the new path and the existing `chatGenerate` share diagram sanitization. The frontend `NewProjectChat` becomes a form → converse-loop → preview-modal flow. Project is created on form submit, before the DFD conversation.

**Tech Stack:** NestJS 10 + Prisma 5 (backend, jest), Next.js 16 + React 18 + React Flow 11 + Tailwind v3 (frontend, tsc + build verification).

## Global Constraints

- **No assumed tech stack** in generated DFDs — the `technology` field MUST be omitted from generated nodes (do not guess `PostgreSQL 15`, etc.).
- **Minimal first DFD** — only trust boundaries STRIDE strictly needs (typically Internet + Internal); generic labels (`Auth Service`, not `Kong Gateway`).
- **Refuse non-software input on EVERY turn**, not just the first.
- **Never log raw prompt/user content by default** — lifecycle metadata only; truncated (≤120 char) user input logged ONLY when `process.env.AI_DEBUG === 'true'`.
- **Project created on form submit**, before the DFD conversation.
- **Do NOT modify** the existing `chatGenerate` behavior or the `POST /api/ai/chat/generate` endpoint — only refactor shared helpers out of it without changing its output.
- Backend tests: `cd apps/backend && npm test`. Frontend verification: `cd apps/frontend && npx tsc --noEmit && npm run build`.
- Every LLM turn writes an `AiInteraction` row (AI history) and `ChatMessage` rows (projectId always known).
- New-project greeting copy MUST state: *"A project is a new application — frontend, backend, or both. Diagrams cover individual features or flows within it."*
- **Codebase orientation:** both apps ship a generated graphify knowledge graph (`graphify-out/`). Before reading/grepping source for any task, run `graphify query "<question>"` (or `graphify explain "<concept>"` / `graphify path "<A>" "<B>"`) to get a scoped subgraph; only read raw files to modify/debug specific lines. After code changes, run `graphify update .` in the changed app to keep the graph current (AST-only, no API cost).

---

## File Structure

**Backend (`apps/backend/src/ai`):**
- `diagram-postprocess.ts` — **new**. Pure helpers extracted from `chatGenerate`: `sanitizeNodePositions`, `validateOversizeWarning`, `coerceName`. Shared by both paths.
- `diagram-postprocess.spec.ts` — **new**. Unit tests for the helpers.
- `new-project/converse-parser.ts` — **new**. Pure `parseConverse(raw): ConverseResult` — JSON extraction + `mode` discrimination + node sanitize + strip `technology`.
- `new-project/converse-parser.spec.ts` — **new**. Unit tests for all three modes + no-technology guarantee.
- `prompts/new-project-converse-prompt.ts` — **new**. `NEW_PROJECT_CONVERSE_PROMPT`.
- `dto/converse.dto.ts` — **new**. `ConverseDto` (`projectId`, `messages[]`).
- `ai.service.ts` — **modify**. Refactor `chatGenerate` to use `diagram-postprocess.ts`; add `converse()`.
- `ai.controller.ts` — **modify**. Add `@Post('new-project/converse')`.

**Frontend (`apps/frontend`):**
- `lib/api.ts` — **modify**. Add `apiConverse`; add shared `ConverseResponse` type.
- `components/DiagramPreviewModal.tsx` — **new**. Fullscreen read-only pan/zoom preview.
- `components/NewProjectChat.tsx` — **modify**. Rework into form phase + converse loop + preview modal.

---

## Task 1: Extract shared diagram post-processing helpers

Refactor the inline sanitize/validate logic out of `chatGenerate` into a pure, tested module. `chatGenerate` output must not change.

**Files:**
- Create: `apps/backend/src/ai/diagram-postprocess.ts`
- Test: `apps/backend/src/ai/diagram-postprocess.spec.ts`
- Modify: `apps/backend/src/ai/ai.service.ts` (lines ~151–179 currently hold the inline logic inside `chatGenerate`)

**Interfaces:**
- Produces:
  - `sanitizeNodePositions(nodes: unknown[], onDefault?: (id: string) => void): Array<Record<string, unknown>>` — returns nodes with every `position` guaranteed to have numeric `x`/`y` (grid fallback otherwise).
  - `validateOversizeWarning(w: unknown): { reason: string; suggestedSplits: string[] } | undefined`
  - `coerceName(v: unknown, maxLen: number): string | undefined`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/ai/diagram-postprocess.spec.ts`:

```typescript
import { sanitizeNodePositions, validateOversizeWarning, coerceName } from './diagram-postprocess';

describe('diagram-postprocess', () => {
  describe('sanitizeNodePositions', () => {
    it('keeps valid numeric positions untouched', () => {
      const nodes = [{ id: 'a', position: { x: 10, y: 20 } }];
      expect(sanitizeNodePositions(nodes)[0].position).toEqual({ x: 10, y: 20 });
    });

    it('defaults missing positions to a grid and reports the id', () => {
      const seen: string[] = [];
      const out = sanitizeNodePositions([{ id: 'a' }, { id: 'b', position: {} }], (id) => seen.push(id));
      expect(typeof (out[0].position as { x: unknown }).x).toBe('number');
      expect(typeof (out[1].position as { y: unknown }).y).toBe('number');
      expect(seen).toEqual(['a', 'b']);
    });
  });

  describe('validateOversizeWarning', () => {
    it('accepts a well-formed warning', () => {
      const w = { reason: 'big', suggestedSplits: ['A', 'B'] };
      expect(validateOversizeWarning(w)).toEqual(w);
    });

    it('rejects malformed warnings', () => {
      expect(validateOversizeWarning(null)).toBeUndefined();
      expect(validateOversizeWarning({ reason: 'x', suggestedSplits: [1] })).toBeUndefined();
      expect(validateOversizeWarning({ reason: 5, suggestedSplits: [] })).toBeUndefined();
    });
  });

  describe('coerceName', () => {
    it('trims and truncates non-empty strings', () => {
      expect(coerceName('  Orders Platform  ', 60)).toBe('Orders Platform');
      expect(coerceName('x'.repeat(100), 10)).toHaveLength(10);
    });

    it('returns undefined for empty/non-string', () => {
      expect(coerceName('   ', 60)).toBeUndefined();
      expect(coerceName(42, 60)).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && npm test -- diagram-postprocess`
Expected: FAIL — `Cannot find module './diagram-postprocess'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/backend/src/ai/diagram-postprocess.ts`:

```typescript
/** Pure diagram post-processing shared by chatGenerate and the new-project converse flow. */

/** Guarantee every node has a numeric position; grid-fallback + report the ones that were missing. */
export function sanitizeNodePositions(
  nodes: unknown[],
  onDefault?: (id: string) => void,
): Array<Record<string, unknown>> {
  return (nodes as Array<Record<string, unknown>>).map((n, idx) => {
    const pos = n.position as { x?: unknown; y?: unknown } | undefined;
    const hasValid = pos && typeof pos.x === 'number' && typeof pos.y === 'number';
    if (!hasValid) {
      onDefault?.(String(n.id ?? idx));
      return { ...n, position: { x: 100 + (idx % 5) * 220, y: 100 + Math.floor(idx / 5) * 160 } };
    }
    return n;
  });
}

/** Validate the optional oversize warning shape; drop it if malformed. */
export function validateOversizeWarning(
  w: unknown,
): { reason: string; suggestedSplits: string[] } | undefined {
  const warn = w as { reason?: unknown; suggestedSplits?: unknown } | null | undefined;
  if (
    warn &&
    typeof warn.reason === 'string' &&
    Array.isArray(warn.suggestedSplits) &&
    warn.suggestedSplits.every((s) => typeof s === 'string')
  ) {
    return { reason: warn.reason, suggestedSplits: warn.suggestedSplits as string[] };
  }
  return undefined;
}

/** Trim + truncate a candidate name; undefined when empty/non-string. */
export function coerceName(v: unknown, maxLen: number): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, maxLen) : undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && npm test -- diagram-postprocess`
Expected: PASS (3 describe blocks green).

- [ ] **Step 5: Refactor `chatGenerate` to use the helpers**

In `apps/backend/src/ai/ai.service.ts`, add to the imports near the top:

```typescript
import { sanitizeNodePositions, validateOversizeWarning, coerceName } from './diagram-postprocess';
```

Replace the inline block (currently the `sanitizedNodes` map at ~152–160, the `oversizeWarning` at ~163–169, and the `projectName`/`diagramName` at ~172–179) with:

```typescript
    const sanitizedNodes = sanitizeNodePositions(diagram.nodes, (id) =>
      this.logger.warn(`[ChatGenerate] node ${id} missing valid position — defaulting`),
    );
    const oversizeWarning = validateOversizeWarning(diagram.oversizeWarning);
    const projectName = coerceName(diagram.projectName, 60);
    const diagramName = coerceName(diagram.diagramName, 80);
```

Leave everything else in `chatGenerate` (the `AiInteraction` write, the `chat.saveMessages`, the return) unchanged.

- [ ] **Step 6: Verify nothing regressed**

Run: `cd apps/backend && npm test && npx tsc -p tsconfig.json --noEmit`
Expected: PASS — existing `ai.service.spec.ts` still green, no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/ai/diagram-postprocess.ts apps/backend/src/ai/diagram-postprocess.spec.ts apps/backend/src/ai/ai.service.ts
git commit -m "refactor: extract shared diagram post-processing helpers"
```

---

## Task 2: New-project converse prompt

**Files:**
- Create: `apps/backend/src/ai/prompts/new-project-converse-prompt.ts`

**Interfaces:**
- Produces: `NEW_PROJECT_CONVERSE_PROMPT: string`

- [ ] **Step 1: Create the prompt**

Create `apps/backend/src/ai/prompts/new-project-converse-prompt.ts`:

```typescript
/**
 * System prompt for the new-project conversational DFD builder.
 *
 * Multi-turn. Every turn the model returns ONE JSON object with a `mode`:
 *  - "refuse":   input is not a software system/flow — decline politely, no diagram.
 *  - "ask":      software input but under-specified — ask the SINGLE most useful clarifying question.
 *  - "generate": enough context — emit the SMALLEST correct DFD, NO assumed tech stack.
 *
 * Contrast with LAYERS_SYSTEM_PROMPT: no mandatory tech stack, no mandatory 3-4 boundaries.
 */
export const NEW_PROJECT_CONVERSE_PROMPT = `You are a CISSP-certified threat-modeling assistant embedded in Layers, guiding a user to build their FIRST Data Flow Diagram (DFD) for a software application through a short conversation.

You output ONLY a single valid JSON object per turn. No markdown fences, no prose outside the JSON.

## Turn Modes
Every turn, choose exactly one mode:

1. "refuse" — The latest user message does NOT describe a software application, system, or data flow (e.g. cooking, sports, general chit-chat, hardware-only, unrelated). Politely decline and state you can only model software applications. Never emit a diagram in this mode.
   { "mode": "refuse", "message": "short polite decline explaining you only model software applications and inviting them to describe an app/flow" }

2. "ask" — The input IS about software but you do not yet have enough to draw a minimal, correct DFD. Ask the SINGLE most useful clarifying question. Prefer asking over guessing. Do NOT assume a tech stack.
   { "mode": "ask", "message": "one concise clarifying question" }

3. "generate" — You have enough to draw the SMALLEST correct DFD for the flow the user described.
   { "mode": "generate", "message": "one-sentence summary of what you drew", "diagramName": "...", "nodes": [...], "edges": [...], "oversizeWarning"?: {...} }

## Refusal applies EVERY turn
Re-check the latest user message each turn. If the conversation drifts to non-software topics mid-way, return "refuse".

## Minimal DFD Rules (mode "generate")
- Keep it LIGHTWEIGHT. Draw only what the user described. Do NOT pad with services/stores they didn't mention.
- NO assumed technology. NEVER include a "technology" field on nodes. Use generic labels ("Auth Service", "User Database") — not concrete products ("Kong", "PostgreSQL 15").
- Trust boundaries: include only what STRIDE strictly needs — typically just Internet (external) and Internal. Add a Data tier or DMZ ONLY if the user's description clearly warrants it.
- Every non-external node MUST be a child of a trustboundary node (parentNode set, extent "parent"). External entities (clients, third-party APIs, end users) sit OUTSIDE all boundaries.
- Edge labels state what data flows; append transport security when a boundary is crossed ("Credentials (HTTPS/TLS)").
- diagramName: 3-6 words, Title Case, names the flow being modeled (e.g. "User Login Flow"). Not the product name.
- oversizeWarning: include ONLY if the DFD somehow exceeds 25 non-boundary nodes (rare for a minimal DFD); otherwise omit the field entirely.

## Node schema (generate mode)
Available types: service, database, client, gateway, loadbalancer, queue, cache, group, storage, serverless, cdn, external, trustboundary.
Each node: { "id": kebab-case, "type": one-of-above, "position": { "x": number, "y": number }, "data": { "label": string, "trustLevel": "internal|dmz|external|internet" }, "style"?: { "width": number, "height": number }, "parentNode"?: string, "extent"?: "parent" }
DO NOT emit a "data.technology" field.
Each edge: { "id": string, "source": string, "target": string, "label": string, "animated": boolean, "type": "smoothstep" }

## Layout
External entities far left (x 50-200), boundaries left-to-right; trust boundary nodes sized to contain children; child positions relative to parent top-left; spread vertically to avoid overlap.

Respond with ONLY the JSON object for this turn.`;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/backend && npx tsc -p tsconfig.json --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/ai/prompts/new-project-converse-prompt.ts
git commit -m "feat: add new-project converse prompt"
```

---

## Task 3: Converse response parser

Pure parser turning a raw LLM string into a typed `ConverseResult`. This is where the no-technology guarantee and mode discrimination are enforced and tested.

**Files:**
- Create: `apps/backend/src/ai/new-project/converse-parser.ts`
- Test: `apps/backend/src/ai/new-project/converse-parser.spec.ts`

**Interfaces:**
- Consumes: `sanitizeNodePositions`, `validateOversizeWarning`, `coerceName` from `../diagram-postprocess`.
- Produces:
  - Type `ConverseResult =
      | { mode: 'refuse'; message: string }
      | { mode: 'ask'; message: string }
      | { mode: 'generate'; message: string; diagramName?: string; nodes: unknown[]; edges: unknown[]; oversizeWarning?: { reason: string; suggestedSplits: string[] } }`
  - `parseConverse(raw: string, onDefaultPos?: (id: string) => void): ConverseResult`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/ai/new-project/converse-parser.spec.ts`:

```typescript
import { parseConverse } from './converse-parser';

describe('parseConverse', () => {
  it('parses a refuse turn', () => {
    const r = parseConverse('{"mode":"refuse","message":"I only model software."}');
    expect(r.mode).toBe('refuse');
    if (r.mode === 'refuse') expect(r.message).toContain('software');
  });

  it('parses an ask turn', () => {
    const r = parseConverse('{"mode":"ask","message":"Which flow first?"}');
    expect(r.mode).toBe('ask');
  });

  it('strips markdown fences before parsing', () => {
    const r = parseConverse('```json\n{"mode":"ask","message":"hi"}\n```');
    expect(r.mode).toBe('ask');
  });

  it('parses a generate turn and sanitizes positions', () => {
    const raw = JSON.stringify({
      mode: 'generate',
      message: 'Drew login flow',
      diagramName: 'User Login Flow',
      nodes: [{ id: 'client', type: 'client' }, { id: 'api', type: 'service', position: { x: 5, y: 6 } }],
      edges: [{ id: 'e1', source: 'client', target: 'api', label: 'Creds (HTTPS/TLS)' }],
    });
    const r = parseConverse(raw);
    expect(r.mode).toBe('generate');
    if (r.mode === 'generate') {
      expect(typeof (r.nodes[0] as { position: { x: unknown } }).position.x).toBe('number');
      expect(r.diagramName).toBe('User Login Flow');
    }
  });

  it('strips any technology field from generated nodes', () => {
    const raw = JSON.stringify({
      mode: 'generate',
      message: 'x',
      diagramName: 'Flow',
      nodes: [{ id: 'db', type: 'database', position: { x: 1, y: 1 }, data: { label: 'DB', technology: 'PostgreSQL 15', trustLevel: 'internal' } }],
      edges: [],
    });
    const r = parseConverse(raw);
    if (r.mode === 'generate') {
      const data = (r.nodes[0] as { data: Record<string, unknown> }).data;
      expect(data.technology).toBeUndefined();
      expect(data.label).toBe('DB');
    } else {
      throw new Error('expected generate');
    }
  });

  it('throws on invalid JSON', () => {
    expect(() => parseConverse('not json')).toThrow();
  });

  it('throws when generate mode lacks node/edge arrays', () => {
    expect(() => parseConverse('{"mode":"generate","message":"x"}')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && npm test -- converse-parser`
Expected: FAIL — `Cannot find module './converse-parser'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/backend/src/ai/new-project/converse-parser.ts`:

```typescript
import { sanitizeNodePositions, validateOversizeWarning, coerceName } from '../diagram-postprocess';

export type ConverseResult =
  | { mode: 'refuse'; message: string }
  | { mode: 'ask'; message: string }
  | {
      mode: 'generate';
      message: string;
      diagramName?: string;
      nodes: unknown[];
      edges: unknown[];
      oversizeWarning?: { reason: string; suggestedSplits: string[] };
    };

/** Remove any `technology` key from a node's data (no-assumed-tech-stack rule). */
function stripTechnology(nodes: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return nodes.map((n) => {
    const data = n.data as Record<string, unknown> | undefined;
    if (data && 'technology' in data) {
      const { technology: _drop, ...rest } = data;
      return { ...n, data: rest };
    }
    return n;
  });
}

/** Parse one LLM turn into a typed ConverseResult. Throws on unparseable/invalid generate output. */
export function parseConverse(raw: string, onDefaultPos?: (id: string) => void): ConverseResult {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const obj = JSON.parse(cleaned) as { mode?: unknown; message?: unknown } & Record<string, unknown>;
  const message = typeof obj.message === 'string' ? obj.message : '';

  if (obj.mode === 'refuse') return { mode: 'refuse', message };
  if (obj.mode === 'ask') return { mode: 'ask', message };
  if (obj.mode === 'generate') {
    if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
      throw new Error('generate turn missing nodes/edges arrays');
    }
    const nodes = stripTechnology(sanitizeNodePositions(obj.nodes, onDefaultPos));
    return {
      mode: 'generate',
      message,
      diagramName: coerceName(obj.diagramName, 80),
      nodes,
      edges: obj.edges,
      oversizeWarning: validateOversizeWarning(obj.oversizeWarning),
    };
  }
  throw new Error(`unknown converse mode: ${String(obj.mode)}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && npm test -- converse-parser`
Expected: PASS (7 tests green).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ai/new-project/converse-parser.ts apps/backend/src/ai/new-project/converse-parser.spec.ts
git commit -m "feat: add new-project converse response parser"
```

---

## Task 4: Converse DTO

**Files:**
- Create: `apps/backend/src/ai/dto/converse.dto.ts`

**Interfaces:**
- Produces:
  - `ConverseMessageDto { role: 'user' | 'ai'; text: string }`
  - `ConverseDto { projectId: string; messages: ConverseMessageDto[] }`

- [ ] **Step 1: Create the DTO**

Create `apps/backend/src/ai/dto/converse.dto.ts`:

```typescript
import { IsArray, IsIn, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ConverseMessageDto {
  @IsIn(['user', 'ai'])
  role: 'user' | 'ai';

  @IsString()
  text: string;
}

export class ConverseDto {
  @IsUUID()
  projectId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConverseMessageDto)
  messages: ConverseMessageDto[];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/backend && npx tsc -p tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/ai/dto/converse.dto.ts
git commit -m "feat: add converse DTO"
```

---

## Task 5: `converse()` service method + lifecycle logging

Wire prompt + parser + persistence + logging into the service. The conversation is rendered into a single user message for the LLM; `AiInteraction` and `ChatMessage` are written every turn.

**Files:**
- Modify: `apps/backend/src/ai/ai.service.ts`
- Test: `apps/backend/src/ai/ai.service.spec.ts` (append a `converse` describe block)

**Interfaces:**
- Consumes: `parseConverse` / `ConverseResult` (Task 3), `NEW_PROJECT_CONVERSE_PROMPT` (Task 2), `ConverseDto` (Task 4), existing `this.llm.invoke`, `this.buildLlmConfig`, `this.prisma.aiInteraction`, `this.chat.saveMessages`.
- Produces: `converse(userId: string, dto: ConverseDto): Promise<ConverseResult>`.

- [ ] **Step 1: Write the failing test**

Look at the existing `apps/backend/src/ai/ai.service.spec.ts` to copy its module-setup / mock style (how `LlmService`, `PrismaService`, `ChatService` are provided). Append:

```typescript
describe('converse', () => {
  it('returns refuse without persisting a diagram-shaped response', async () => {
    // Arrange: llm.invoke mocked to return a refuse JSON (see existing spec for mock wiring)
    llm.invoke.mockResolvedValue({
      content: '{"mode":"refuse","message":"I only model software applications."}',
      tokensUsed: 5, inputTokens: 3, outputTokens: 2, provider: 'anthropic', model: 'x',
    });
    const res = await service.converse('user-1', {
      projectId: '00000000-0000-0000-0000-000000000000',
      messages: [{ role: 'user', text: 'how do I bake bread' }],
    });
    expect(res.mode).toBe('refuse');
    expect(prisma.aiInteraction.create).toHaveBeenCalled();
  });

  it('returns a generate result with sanitized nodes and no technology', async () => {
    llm.invoke.mockResolvedValue({
      content: JSON.stringify({
        mode: 'generate', message: 'Drew it', diagramName: 'Login Flow',
        nodes: [{ id: 'db', type: 'database', position: { x: 1, y: 1 }, data: { label: 'DB', technology: 'PostgreSQL', trustLevel: 'internal' } }],
        edges: [],
      }),
      tokensUsed: 9, inputTokens: 5, outputTokens: 4, provider: 'anthropic', model: 'x',
    });
    const res = await service.converse('user-1', {
      projectId: '00000000-0000-0000-0000-000000000000',
      messages: [{ role: 'user', text: 'model a login flow with a db' }],
    });
    expect(res.mode).toBe('generate');
    if (res.mode === 'generate') {
      expect((res.nodes[0] as { data: Record<string, unknown> }).data.technology).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && npm test -- ai.service`
Expected: FAIL — `service.converse is not a function`.

- [ ] **Step 3: Add imports and the method**

In `apps/backend/src/ai/ai.service.ts` imports:

```typescript
import { NEW_PROJECT_CONVERSE_PROMPT } from './prompts/new-project-converse-prompt';
import { parseConverse, ConverseResult } from './new-project/converse-parser';
import { ConverseDto } from './dto/converse.dto';
```

Add the method (place it right after `chatGenerate`):

```typescript
async converse(userId: string, dto: ConverseDto): Promise<ConverseResult> {
  const turn = dto.messages.length;
  this.logger.log(`[new-project] turn=${turn} userId=${userId} projectId=${dto.projectId} received`);
  if (process.env.AI_DEBUG === 'true') {
    const last = dto.messages[dto.messages.length - 1]?.text ?? '';
    this.logger.log(`[new-project] input(120)="${last.slice(0, 120)}"`);
  }

  const transcript = dto.messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n');
  const llmConfig = await this.buildLlmConfig(userId);
  const startTime = Date.now();
  const llmResult = await this.llm.invoke(NEW_PROJECT_CONVERSE_PROMPT, transcript, {
    ...llmConfig,
    promptName: 'NEW_PROJECT_CONVERSE_PROMPT',
  });
  const durationMs = Date.now() - startTime;

  let result: ConverseResult;
  try {
    result = parseConverse(llmResult.content, (id) =>
      this.logger.warn(`[new-project] node ${id} missing valid position — defaulting`),
    );
  } catch (err) {
    this.logger.error(`[new-project] parse-failed turn=${turn} err=${String(err)}`);
    // Degrade to an ask so the conversation can continue.
    result = { mode: 'ask', message: 'Could you add a bit more detail about that flow?' };
  }

  if (result.mode === 'generate') {
    const nodeCount = result.nodes.length;
    const edgeCount = result.edges.length;
    const boundaryCount = (result.nodes as Array<{ type?: string }>).filter((n) => n.type === 'trustboundary').length;
    this.logger.log(`[new-project] mode=generate turn=${turn} parsed nodes=${nodeCount} edges=${edgeCount} boundaries=${boundaryCount}`);
  } else {
    this.logger.log(`[new-project] mode=${result.mode} turn=${turn}`);
  }

  const lastUser = [...dto.messages].reverse().find((m) => m.role === 'user')?.text ?? '';
  await this.prisma.aiInteraction
    .create({
      data: {
        userId,
        diagramId: null,
        prompt: `[new-project] ${lastUser}`,
        response: {
          mode: result.mode,
          ...(result.mode === 'generate'
            ? { nodeCount: result.nodes.length, edgeCount: result.edges.length, diagramName: result.diagramName }
            : { message: result.message }),
        },
        tokensUsed: llmResult.tokensUsed,
        inputTokens: llmResult.inputTokens,
        outputTokens: llmResult.outputTokens,
        model: `${llmResult.provider}/${llmResult.model}`,
        durationMs,
      },
    })
    .catch((e: unknown) => this.logger.error(`[new-project] failed to persist aiInteraction: ${String(e)}`));

  const assistantContent =
    result.mode === 'generate'
      ? `${result.message} (${result.nodes.length} nodes, ${result.edges.length} edges)`
      : result.message;
  await this.chat
    .saveMessages(dto.projectId, userId, [
      { role: 'user', content: lastUser },
      {
        role: 'assistant',
        content: assistantContent,
        provider: llmResult.provider,
        model: llmResult.model,
        inputTokens: llmResult.inputTokens,
        outputTokens: llmResult.outputTokens,
      },
    ])
    .catch((e: unknown) => this.logger.error(`[new-project] failed to persist chat: ${String(e)}`));

  this.logger.log(`[new-project] done turn=${turn} durationMs=${durationMs}`);
  return result;
}
```

Note: `ChatService.saveMessages` accepts `ChatMessageItemDto[]`; `layerId`/`layerName`/`diagramData` are optional there, so omitting them is fine.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && npm test -- ai.service`
Expected: PASS (both new `converse` tests green; existing tests still green).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ai/ai.service.ts apps/backend/src/ai/ai.service.spec.ts
git commit -m "feat: add converse service method with lifecycle logging"
```

---

## Task 6: Converse controller route

**Files:**
- Modify: `apps/backend/src/ai/ai.controller.ts`

**Interfaces:**
- Consumes: `AiService.converse` (Task 5), `ConverseDto` (Task 4).
- Produces: `POST /api/ai/new-project/converse`.

- [ ] **Step 1: Add the import and route**

In `apps/backend/src/ai/ai.controller.ts`, add to the DTO imports:

```typescript
import { ConverseDto } from './dto/converse.dto';
```

Add the route inside the controller class, right after the `chatGenerate` handler:

```typescript
@Post('new-project/converse')
converse(@CurrentUser('id') userId: string, @Body() dto: ConverseDto) {
  return this.ai.converse(userId, dto);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/backend && npx tsc -p tsconfig.json --noEmit && npm test`
Expected: PASS — compiles, all tests green.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/ai/ai.controller.ts
git commit -m "feat: add new-project converse endpoint"
```

---

## Task 7: Frontend API client — `apiConverse`

**Files:**
- Modify: `apps/frontend/lib/api.ts`

**Interfaces:**
- Produces:
  - `type ConverseMessage = { role: 'user' | 'ai'; text: string }`
  - `type ConverseResponse` — union mirroring the backend `ConverseResult` (`refuse` / `ask` / `generate`).
  - `apiConverse(payload: { projectId: string; messages: ConverseMessage[] }): Promise<ConverseResponse>`

- [ ] **Step 1: Add types + function**

In `apps/frontend/lib/api.ts`, after the `apiChatGenerate` block (near line 408), add:

```typescript
export type ConverseMessage = { role: 'user' | 'ai'; text: string };

export type ConverseResponse =
  | { mode: 'refuse'; message: string }
  | { mode: 'ask'; message: string }
  | {
      mode: 'generate';
      message: string;
      diagramName?: string;
      nodes: unknown[];
      edges: unknown[];
      oversizeWarning?: OversizeWarning;
    };

/** New-project conversational DFD builder — one turn per call, full transcript sent each time. */
export function apiConverse(payload: {
  projectId: string;
  messages: ConverseMessage[];
}): Promise<ConverseResponse> {
  return apiFetch<ConverseResponse>('/api/ai/new-project/converse', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 2: Verify types**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: PASS (0 errors).

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/lib/api.ts
git commit -m "feat: add apiConverse client for new-project flow"
```

---

## Task 8: `DiagramPreviewModal` component

Fullscreen read-only preview reusing `MiniDiagramPreview`, closable via X button and `Esc`.

**Files:**
- Create: `apps/frontend/components/DiagramPreviewModal.tsx`

**Interfaces:**
- Consumes: `MiniDiagramPreview` (default export, props `{ nodes, edges, className }`).
- Produces: `DiagramPreviewModal` default export — props `{ nodes: unknown[]; edges: unknown[]; title?: string; onClose: () => void }`.

- [ ] **Step 1: Create the component**

Create `apps/frontend/components/DiagramPreviewModal.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import MiniDiagramPreview from './MiniDiagramPreview';

interface DiagramPreviewModalProps {
  nodes: unknown[];
  edges: unknown[];
  title?: string;
  onClose: () => void;
}

export default function DiagramPreviewModal({ nodes, edges, title, onClose }: DiagramPreviewModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <span className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">
            {title ?? 'Diagram preview'}
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <MiniDiagramPreview nodes={nodes} edges={edges} className="h-full rounded-none border-0" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/DiagramPreviewModal.tsx
git commit -m "feat: add fullscreen DiagramPreviewModal"
```

---

## Task 9: Rework `NewProjectChat` — form phase + converse loop + preview modal

The biggest change. Adds a `form` phase (project name + description → create project), a `chat` phase driven by `apiConverse` (multi-turn, mode-aware), and an expand button opening `DiagramPreviewModal`.

**Files:**
- Modify: `apps/frontend/components/NewProjectChat.tsx`

**Interfaces:**
- Consumes: `apiCreateProject(name, description?)`, `apiCreateDiagram(projectId, name, canvasData)`, `apiConverse` + `ConverseMessage`/`ConverseResponse` (Task 7), `DiagramPreviewModal` (Task 8), existing `MiniDiagramPreview`, `OversizeWarning`.

- [ ] **Step 1: Update imports and phase type**

At the top of `apps/frontend/components/NewProjectChat.tsx`, extend the api import and add the new ones:

```tsx
import {
  apiCreateProject, apiCreateDiagram, apiConverse,
  type OversizeWarning, type ConverseMessage,
} from '@/lib/api';
import DiagramPreviewModal from './DiagramPreviewModal';
```

Change the `Phase` type to include the form phase:

```tsx
type Phase = 'form' | 'chat' | 'complete';
```

- [ ] **Step 2: Replace component state + mount greeting**

Replace the state block (currently starts at `const [messages, ...]`) and the mount `useEffect` greeting so the flow starts on the `form` phase. Replace the initial `phase` state and the greeting effect with:

```tsx
const [phase, setPhase] = useState<Phase>('form');
const [projectName, setProjectName] = useState('');
const [projectDescription, setProjectDescription] = useState('');
const [creatingProject, setCreatingProject] = useState(false);

const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [thinking, setThinking] = useState(false);
const [thinkingLabel, setThinkingLabel] = useState('');
const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
const [diagramNodes, setDiagramNodes] = useState<unknown[]>([]);
const [diagramEdges, setDiagramEdges] = useState<unknown[]>([]);
const [diagramName, setDiagramName] = useState<string>('');
const [showModal, setShowModal] = useState(false);
const [showNavPrompt, setShowNavPrompt] = useState(false);
const [navPromptDismissed, setNavPromptDismissed] = useState(false);
const [oversizeWarning, setOversizeWarning] = useState<OversizeWarning | null>(null);
const bottomRef = useRef<HTMLDivElement>(null);
const inputRef = useRef<HTMLTextAreaElement>(null);
```

Delete the old mount `useEffect` that pushed the greeting (the one calling `addMessage('ai', "Hi! Let's set up your first Data Flow Diagram...")`). The greeting now appears when the chat phase starts (Step 4).

- [ ] **Step 3: Add the form-submit handler**

Add near the other handlers:

```tsx
const handleCreateProject = useCallback(async () => {
  const name = projectName.trim();
  if (!name || creatingProject) return;
  setCreatingProject(true);
  try {
    const project = await apiCreateProject(name, projectDescription.trim() || undefined);
    setCreatedProjectId(project.id);
    setPhase('chat');
    setMessages([{
      id: generateId(), role: 'ai',
      text: "Great — now let's model your first flow. Describe one feature or flow to threat-model (e.g. \"user login with email + password\"). I'll ask a couple of questions, then draw a lightweight DFD. I won't assume your tech stack.",
    }]);
    setTimeout(() => inputRef.current?.focus(), 50);
  } catch {
    // surface error inline; stay on the form
    setMessages([]);
    alert('Could not create the project. Please try again.');
  } finally {
    setCreatingProject(false);
  }
}, [projectName, projectDescription, creatingProject]);
```

- [ ] **Step 4: Replace `handleSend` with the converse loop**

Replace the entire existing `handleSend` `useCallback` with:

```tsx
const handleSend = useCallback(async () => {
  const text = input.trim();
  if (!text || thinking || phase !== 'chat' || !createdProjectId) return;

  setInput('');
  addMessage('user', text);
  setThinking(true);
  setThinkingLabel('Thinking…');

  // Build transcript from prior messages + this new user turn.
  const transcript: ConverseMessage[] = [
    ...messages.map((m) => ({ role: m.role, text: m.text })),
    { role: 'user' as const, text },
  ];

  try {
    const res = await apiConverse({ projectId: createdProjectId, messages: transcript });

    if (res.mode === 'refuse' || res.mode === 'ask') {
      setThinking(false);
      setThinkingLabel('');
      addMessage('ai', res.message);
      return;
    }

    // mode === 'generate'
    setThinkingLabel('Saving diagram…');
    const dName = res.diagramName?.trim() || 'Untitled Flow';
    const canvasData = {
      layers: {
        root: {
          id: 'root', name: dName, description: dName,
          parentLayerId: null, parentNodeId: null,
          nodes: res.nodes, edges: res.edges,
          createdAt: new Date().toISOString(),
        },
      },
      navStack: ['root'],
    };
    await apiCreateDiagram(createdProjectId, dName, canvasData);

    setDiagramNodes(res.nodes);
    setDiagramEdges(res.edges);
    setDiagramName(dName);
    if (res.oversizeWarning) setOversizeWarning(res.oversizeWarning);
    setThinking(false);
    setThinkingLabel('');
    addMessage('ai', res.message || `Your DFD is ready — ${res.nodes.length} elements. Here's a preview:`);
    setPhase('complete');
    if (embedded) {
      setShowNavPrompt(true);
      onCreated?.(createdProjectId);
    }
  } catch {
    setThinking(false);
    setThinkingLabel('');
    addMessage('ai', 'I had trouble with that. Your project is created — you can open it and build manually, or try describing the flow again.');
  }
}, [input, thinking, phase, createdProjectId, messages, embedded, onCreated]);
```

- [ ] **Step 5: Add the form UI and gate the chat/input on phase**

Add a `formView` block and render it when `phase === 'form'`. Insert before the `chatThread` definition:

```tsx
const formView = (
  <div className="flex-1 overflow-y-auto px-4 py-10">
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40">
          <Sparkles size={22} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-[18px] font-semibold text-slate-800 dark:text-slate-100">Start a new project</h2>
        <p className="mx-auto mt-1 max-w-[420px] text-[14px] text-slate-500 dark:text-slate-400">
          A project is a new application — frontend, backend, or both. Diagrams cover individual features or flows within it.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Project name</label>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
          placeholder="e.g. Acme Banking App"
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-800 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Description <span className="text-slate-400">(optional)</span></label>
        <textarea
          value={projectDescription}
          onChange={(e) => setProjectDescription(e.target.value)}
          rows={3}
          placeholder="What does this application do? Who uses it?"
          className="resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] leading-relaxed text-slate-800 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <button
        onClick={handleCreateProject}
        disabled={!projectName.trim() || creatingProject}
        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {creatingProject ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        Continue to diagram
      </button>
    </div>
  </div>
);
```

Then update the render bodies (both `embedded` and standalone) so the body is phase-aware and the input bar only shows in chat/complete phases. Replace `{chatThread}{inputBar}` in **both** layouts with:

```tsx
{phase === 'form' ? formView : chatThread}
{phase !== 'form' && inputBar}
```

Also remove the now-unused `EmptyHero` render inside `chatThread` (the `{messages.length === 0 && !thinking && <EmptyHero />}` line) since the form replaces it; you may delete the `EmptyHero` function too if unused.

- [ ] **Step 6: Add the expand button + modal to the preview card**

In `chatThread`, replace the preview-card block (the `phase === 'complete' && diagramNodes.length > 0` section) with a version that adds an expand button and mounts the modal:

```tsx
{phase === 'complete' && diagramNodes.length > 0 && (
  <div className="flex justify-start pl-9">
    <div className="w-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <div className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
          {diagramNodes.length} components · {diagramEdges.length} connections
        </span>
        <button
          onClick={() => setShowModal(true)}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
        >
          <ExternalLink size={12} /> Expand
        </button>
      </div>
      <div className="h-[240px]">
        <MiniDiagramPreview nodes={diagramNodes} edges={diagramEdges} className="h-full rounded-none border-0" />
      </div>
    </div>
  </div>
)}
```

Add the modal mount just before the final `</div>` of the returned JSX in **both** layouts (or once at the top level of the component return). Simplest: render it inside `chatThread` right after `<div ref={bottomRef} />`:

```tsx
{showModal && (
  <DiagramPreviewModal
    nodes={diagramNodes}
    edges={diagramEdges}
    title={diagramName || 'Diagram preview'}
    onClose={() => setShowModal(false)}
  />
)}
```

- [ ] **Step 7: Fix the input bar disabled condition**

In `inputBar`, the `disabled` conditions currently check `phase === 'complete'`. Keep that — input should be enabled only during `chat`. Confirm both the `<textarea>` and send `<button>` use `disabled={thinking || phase === 'complete'}` (they already do). No change needed unless the phase rename broke it — verify it reads `phase === 'complete'`.

- [ ] **Step 8: Verify types + build**

Run: `cd apps/frontend && npx tsc --noEmit && npm run build`
Expected: PASS — 0 type errors, build succeeds. Fix any unused-import warnings (e.g. remove `Shield/Zap/BarChart3` only if you also removed `ActionButtons`; keep them — `ActionButtons` is still used).

- [ ] **Step 9: Manual verification**

Run frontend + backend dev servers. Then:
1. New project → **form** appears with the "project is an application" helper copy.
2. Enter name + description → **Continue** → project created, chat greeting appears.
3. Type a non-software message ("how do I bake bread") → AI **declines** (refuse), no diagram.
4. Type a vague software flow → AI **asks** a clarifying question.
5. Answer → AI **generates** a lightweight DFD (few nodes, **no** concrete tech in labels).
6. Click **Expand** → fullscreen modal, pan/zoom works, **Esc** closes.
7. Open project → diagram present.
8. Open the project's AI history page → the conversation turns are logged.
9. Backend logs show `[new-project] turn=… mode=… …` lines.

- [ ] **Step 10: Commit**

```bash
git add apps/frontend/components/NewProjectChat.tsx
git commit -m "feat: two-phase new-project flow with converse loop and preview modal"
```

---

## Self-Review Notes

- **Spec coverage:** framing copy (Task 9 Step 5) ✓; two-phase form→chat (Tasks 3–9) ✓; ask-first minimal DFD (Task 2 prompt) ✓; no tech stack (Task 3 `stripTechnology` + Task 2 prompt) ✓; refuse every turn (Task 2 prompt + Task 5) ✓; fullscreen modal (Tasks 8–9) ✓; lifecycle + `AI_DEBUG` logging (Task 5) ✓; whole conversation in AI history (Task 5 `AiInteraction` per turn) ✓; project on form submit (Task 9 Step 3) ✓; `chatGenerate` untouched (Task 1 refactor only) ✓.
- **Type consistency:** `ConverseResult` (backend) mirrors `ConverseResponse` (frontend); `parseConverse` signature matches its call in Task 5; `apiConverse` payload matches `ConverseDto`.
- **No placeholders:** all code blocks complete; no TBD/TODO.
