# Threat Analysis Agent Chat — Design Spec

**Date:** 2026-03-29
**Branch:** `featuresecurity-intel-platform`
**Status:** Approved, ready for implementation

---

## Overview

Transform the current one-shot "Run STRIDE Threat Analysis" button into an interactive, multi-turn agentic conversation. The AI agent analyzes the diagram first, asks targeted questions to determine application type (standard / GenAI / Agentic AI), then kicks off a background threat analysis job using the appropriate framework (STRIDE + CISSP, optionally + OWASP LLM Top 10, optionally + OWASP Agentic AI Top 10). The entire conversation is persisted to ChromaDB for future RAG retrieval and resumable across sessions.

---

## Repositories Affected

- `drafter` (frontend — Next.js 14)
- `drafter-rest` (backend — NestJS)

---

## Architecture: Refined Approach A (Stateless Multi-Turn + Typed SSE)

### Why this approach

- Backend is stateless — full conversation history sent with each request (same pattern as `contextual-ask`)
- Phase transitions driven by LLM output, detected server-side — frontend never parses text for markers
- Typed SSE events: frontend handles typed events, not raw text signals
- No schema migration required (uses existing `ChatMessage` table with reserved `layerId`)
- Clean migration path to stateful sessions (Approach B) later: add `ThreatChatSession` table, change request contract to include `sessionId`, move phase state to DB — frontend gets simpler, not more complex

---

## Conversation Phases

```
[Button click]
      │
      ▼
Phase 1 — DIAGNOSE
  Backend sends diagram snapshot + empty history to LLM
  LLM analyzes nodes/edges, identifies AI-related patterns
  LLM asks ONE focused classification question (app type)
      │
      ▼
Phase 2 — GATHER (≤2 follow-ups, enforced by system prompt)
  User answers → full history + diagram resent each turn
  LLM asks targeted follow-ups based on what it detected
  When ready, LLM appends [ANALYSIS_CONTEXT:{...}] to its final message
      │
      ▼
Phase 3 — ANALYZE (backend-triggered, not frontend)
  Backend strips [ANALYSIS_CONTEXT] from streamed/stored text
  Backend submits job to THREAT_ANALYSIS_QUEUE (BullMQ, existing)
  Emits SSE event: analysis_triggered { jobId }
  Frontend shows inline progress card in thread
  When job completes: emits analysis_complete { summary, keyFindings[], threatCount, modelId }
      │
      ▼
Phase 4 — CONTINUE (optional follow-up Q&A)
  User may ask follow-up questions about specific threats
  Backend routes to threat Q&A mode (no re-analysis unless user explicitly requests)
  All messages saved + indexed to ChromaDB
```

---

## SSE Event Protocol

Endpoint: `POST /api/ai/threat-analysis/chat`
Response content-type: `text/event-stream`

| Event name | Payload | Frontend action |
|---|---|---|
| `message` | `{ delta: string }` | Append to current assistant bubble |
| `message_done` | — | Finalize bubble, save to state |
| `analysis_triggered` | `{ jobId: string }` | Render inline progress card in thread |
| `analysis_complete` | `{ summary: string, keyFindings: KeyFinding[], threatCount: number, modelId: string }` | Morph progress card to summary result card; refresh Threat Model Panel |
| `error` | `{ message: string }` | Show error in chat bubble |

```ts
interface KeyFinding {
  category: string;       // e.g. "LLM01 Prompt Injection"
  count: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}
```

The frontend **never parses text content for markers**. All state transitions come from typed events.

---

## Backend Changes

### 1. New endpoint

`POST /api/ai/threat-analysis/chat`
Auth: `JwtAuthGuard`
Controller: `AiController` (or new `ThreatAgentController` if it grows large)

**Request DTO — `ThreatChatDto`:**
```ts
class ThreatChatDto {
  projectId: string;
  diagramId: string;
  layerId: string;
  layerName?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  trustBoundaries: TrustBoundary[];
}
```

**Handler logic:**
1. Call LLM with `THREAT_AGENT_SYSTEM_PROMPT` + `buildThreatAgentPrompt(input)`, streaming
2. Stream `message` deltas via SSE in real-time
3. On stream end, scan accumulated text for `[ANALYSIS_CONTEXT:{...}]`
4. If found:
   - Strip marker from content before saving to `ChatMessage`
   - Parse `{ appType, confirmedCapabilities }`
   - Enqueue to `THREAT_ANALYSIS_QUEUE` with enriched payload
   - Emit `analysis_triggered { jobId }`
   - Await job completion via BullMQ `job.waitUntilFinished(queueEvents)` (SSE connection stays open; timeout 120s)
   - Job processor returns `{ modelId, threatCount, summary, keyFindings }` as job result
   - Emit `analysis_complete` with job result payload
5. Save both user message + assistant message to `ChatMessage` (layerId = `__threat_analysis__`)
6. Index to ChromaDB via `ragIndexing.indexThreatChatMessages()` (non-blocking)

### 2. New `RagIndexingService` method

```ts
async indexThreatChatMessages(
  projectId: string,
  userId: string,
  messages: ChatMessageItem[],
): Promise<void>
```

Documents tagged: `{ conversationType: 'threat-analysis', layerId: '__threat_analysis__' }`
Indexed per-message (consistent with `indexChatMessages`).
Called non-blocking (fire-and-forget, same pattern as existing indexing calls).

### 3. Enriched job processor payload

Existing `ThreatAnalysisProcessor` receives:
```ts
{
  ...existingFields,
  appType: 'standard' | 'genai' | 'agentic',
  confirmedCapabilities: string[],
}
```

Processor selects prompt variant:
- `standard` → STRIDE + CISSP only (existing `THREAT_ANALYSIS_SYSTEM_PROMPT`)
- `genai` → STRIDE + CISSP + OWASP LLM01–LLM10
- `agentic` → STRIDE + CISSP + OWASP LLM01–LLM10 + OWASP ASI01–ASI10

### 4. New `ChatMessage` convention for threat agent

All threat agent messages stored with:
- `layerId = "__threat_analysis__"` (reserved, never a real layer ID)
- `layerName = "Threat Analysis"`
- `diagramData = { appType?, confirmedCapabilities?, phase? }` (enriches resumption)

Existing `GET /api/projects/:id/chat` endpoint returns these — frontend filters by `layerId`.

---

## Prompt Architecture

### `THREAT_AGENT_SYSTEM_PROMPT`

Three-part structure:

**Part 1 — Role & Behavioral Constraints**
```
You are a security threat modeling agent embedded in an architecture diagram tool.
Your ONLY goal is to produce a thorough threat analysis. You are not a chatbot.

Rules:
- Analyze the diagram first, then ask AT MOST 3 questions total before triggering analysis
- Questions must be focused and goal-oriented (not conversational)
- Never ask questions you can infer from the diagram
- When you have enough context, signal readiness immediately
```

**Part 2 — Application Type Classifier**

| Diagram signals | First question focuses on |
|---|---|
| No LLM/AI nodes detected | Confirm basic app type; ask if any AI integrations are planned/unlabeled |
| LLM/model nodes, vector DBs, embedding services | Confirm GenAI integration type (RAG? fine-tuned? external API?) |
| Agent nodes, tool-use patterns, orchestration services, multi-service chains | Confirm agentic capabilities (autonomous? human-in-loop? what tools granted?) |

**Part 3 — Analysis Trigger Signal**

When ready to analyze, append at the very end of the message (after the last question or after user confirms):
```
[ANALYSIS_CONTEXT:{"appType":"agentic","confirmedCapabilities":["tool-use","multi-agent","rag"]}]
```
Backend strips this before storing or displaying.

### `buildThreatAgentPrompt(input)` — user message builder

```ts
interface ThreatAgentInput {
  diagramSnapshot: {
    layerName: string;
    nodes: SerializedNode[];
    edges: SerializedEdge[];
    trustBoundaries: TrustBoundary[];
  };
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  appContext?: {
    appType: 'standard' | 'genai' | 'agentic';
    confirmedCapabilities: string[];
  };
}
```

Diagram snapshot included on every turn (compact text serialization, ~200–500 tokens). History included in full. `appContext` injected once confirmed to focus follow-up Q&A.

### Threat framework prompt variants (for job processor)

**`STRIDE_ONLY_SYSTEM_PROMPT`** — existing `THREAT_ANALYSIS_SYSTEM_PROMPT` (no change)

**`GENAI_THREAT_SYSTEM_PROMPT`** — extends STRIDE with:
```
## LLM-SPECIFIC THREAT CATEGORIES (OWASP Top 10 for LLM Applications 2026)

LLM01: Prompt Injection — Attackers manipulate inputs to override system prompts...
LLM02: Sensitive Information Disclosure — LLMs may reveal proprietary data, PII...
LLM03: Supply Chain Vulnerabilities — Third-party base models, plugins, datasets...
LLM04: Data and Model Poisoning — Adversaries tamper with training/fine-tuning/RAG data...
LLM05: Improper Output Handling — LLM outputs passed to downstream systems without validation...
LLM06: Excessive Agency — Agentic LLMs with high autonomy or too many permissions...
LLM07: System Prompt Leakage — Attackers extract hidden instructions...
LLM08: Vector and Embedding Weaknesses — RAG vector databases manipulated...
LLM09: Misinformation (Overreliance) — False/biased LLM outputs trusted uncritically...
LLM10: Unbounded Consumption (Model DoS) — Excessive resource consumption...

For each LLM-specific threat, include:
- "strideCategory": closest STRIDE mapping (or "LLM_SPECIFIC" if no direct mapping)
- "owaspCategory": "LLMxx" identifier
```

**`AGENTIC_THREAT_SYSTEM_PROMPT`** — extends GENAI with:
```
## AGENTIC AI THREAT CATEGORIES (OWASP Top 10 for Agentic AI 2026)

ASI01: Agent Goal Hijack — Manipulated instructions cause agent to abandon intended purpose...
ASI02: Tool Misuse & Exploitation — Agents manipulated into using authorized tools destructively...
ASI03: Identity & Privilege Abuse — Agents inherit excessive permissions or reuse credentials...
ASI04: Agentic Supply Chain Vulnerabilities — Compromised third-party tools/plugins/prompts...
ASI05: Unexpected Code Execution — Agents generate and execute malicious code...
ASI06: Memory & Context Poisoning — Long-term memory or RAG databases corrupted...
ASI07: Insecure Inter-Agent Communication — Agents trust fraudulent messages from other agents...
ASI08: Cascading Failures — Small breach triggers systemic failures across multi-agent workflows...
ASI09: Human–Agent Trust Exploitation — Humans over-rely on persuasive agents...
ASI10: Rogue Agents — Agents diverge from designed goals, operating autonomously...

For each Agentic threat, include:
- "strideCategory": closest STRIDE mapping
- "owaspCategory": "ASIxx" identifier
- "agentScope": which agent(s) in the diagram this applies to
```

Output schema extended to include optional `owaspCategory` and `agentScope` fields on each threat object.

---

## Frontend Changes

### Panel: Copilot-style AI workspace

**Dimensions & persistence:**
- Width: `420px` (up from `360px`)
- Closing collapses to `48px` icon strip (not full dismiss) — reduces re-open friction
- Threat mode has its own message thread separate from general AI chat

**Message rendering:**
- Assistant bubbles: left-aligned, no background, shield icon (threat mode) or sparkles (general mode)
- User bubbles: right-aligned, `bg-slate-100 dark:bg-slate-700` pill, max-width 80%
- Timestamps shown on hover only

**Phase timeline markers** (inline dividers in thread, not bubbles):
```
── Diagram analyzed · context gathered ─────────
   🔍 Threat analysis running · STRIDE + LLM10
────────────────────────────────────────────────
```

**Analysis progress card** (inline in thread):
```
┌──────────────────────────────────────────┐
│ 🔍 Analyzing threats                     │
│ Applying STRIDE + OWASP LLM Top 10       │
│ ●●●●●○○○○○  Evaluating nodes...         │
└──────────────────────────────────────────┘
```
On `analysis_complete`, this card morphs via CSS transition into the summary card (no re-render flash).

**Summary result card:**
```
┌──────────────────────────────────────────┐
│ 🛡 18 threats identified                 │
│ 🔴 LLM01 Prompt Injection — 3 threats   │
│ 🔴 ASI06 Memory Poisoning — 2 threats   │
│ 🟡 LLM08 Vector Weaknesses — 4 threats  │
│                                          │
│  [View full model →]                     │
└──────────────────────────────────────────┘
```

**Input area:**
- Clean borderless textarea, placeholder changes by phase
- Quick-action chips below input, contextually updated:
  - Idle: `[Analyze Threats]` (primary CTA)
  - Conversing: no chips
  - After analysis: `[View Threat Model]` `[Re-analyze]` `[Evaluate Architecture]`

**Resume header:**
```
🛡 Threat Intelligence  ·  session from 2 days ago  [+ New]
```
"+ New" clears local thread state; history preserved in ChromaDB.

### UI state machine

```
idle
  └─[click Analyze Threats]→ diagnosing (ThinkingDots "Analyzing your diagram…")
        └─[first delta arrives]→ conversing (user can type replies)
              └─[analysis_triggered]→ analyzing (inline progress card appears)
                    └─[analysis_complete]→ complete (card morphs to summary)
                          └─[user types]→ conversing (follow-up Q&A, no re-analysis)
```

### New `AIChatPanelProps` additions

```ts
onThreatAgentChat?: (payload: ThreatChatPayload) => AsyncGenerator<ThreatChatEvent>;
initialThreatMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
```

### New `lib/api.ts` function

```ts
export async function* apiThreatAgentChat(
  payload: ThreatChatPayload,
): AsyncGenerator<ThreatChatEvent>
```

Uses same SSE streaming pattern as `apiContextualChatAsk`. Parses typed events, yields them. Handles `analysis_triggered` and `analysis_complete` events as structured objects — no text parsing.

---

## Resumability

1. On `AIChatPanel` mount (threat mode), call `GET /api/projects/:id/chat`
2. Filter messages where `layerId === "__threat_analysis__"`
3. If messages exist, populate `threatAgentMessages` state and show resume header
4. On "Run Threat Analysis" click with existing history: send full history to endpoint → LLM sees prior context, continues from where it left off
5. "New session" button: clears `threatAgentMessages` state only (DB records preserved for RAG)

---

## Migration Path to Approach B (Stateful Sessions)

When needed (cross-device sync, longer conversations, analytics on phase data):

1. Add `ThreatChatSession` Prisma model: `{ id, projectId, userId, phase, appType, confirmedCapabilities, createdAt }`
2. Change `ThreatChatDto` to include optional `sessionId`
3. Backend loads/creates session, stores phase server-side
4. Frontend no longer needs to send full history (backend loads from `ChatMessage`)
5. Frontend gets simpler — just sends `{ sessionId, message, diagramData? }`
6. ChromaDB indexing and `ChatMessage` storage unchanged

---

## Files Changed

### `drafter-rest`
| File | Change |
|---|---|
| `src/ai/ai.controller.ts` | Add `POST /ai/threat-analysis/chat` route |
| `src/ai/ai.service.ts` | Add `threatAgentChat()` method with SSE streaming + phase detection |
| `src/ai/dto/threat-chat.dto.ts` | New DTO |
| `src/ai/prompts/threat-analysis-prompt.ts` | Add `THREAT_AGENT_SYSTEM_PROMPT`, `buildThreatAgentPrompt()`, `GENAI_THREAT_SYSTEM_PROMPT`, `AGENTIC_THREAT_SYSTEM_PROMPT` |
| `src/jobs/processors/threat-analysis.processor.ts` | Accept `appType` + `confirmedCapabilities`, select prompt variant; return `{ modelId, threatCount, summary, keyFindings }` as job result |
| `src/rag/rag-indexing.service.ts` | Add `indexThreatChatMessages()` |

### `drafter`
| File | Change |
|---|---|
| `components/AIChatPanel.tsx` | Copilot-style layout, threat agent mode, SSE event handler, UI state machine |
| `lib/api.ts` | Add `apiThreatAgentChat()` streaming generator |
| `components/DiagramPage.tsx` | Wire `onThreatAgentChat` + `initialThreatMessages` props, load threat chat history |

---

## Out of Scope

- New Prisma schema migration (deferred to Approach B)
- Multi-diagram or cross-project threat conversations
- Threat agent for read-only/published diagrams (analysis requires mutable diagram context)
- Mobile/responsive layout for the wider panel
