# Threat Analysis Agent Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the one-shot STRIDE threat analysis button into an interactive multi-turn agent that classifies the application type, asks targeted questions, then runs a background analysis with the right threat framework (STRIDE+CISSP, +OWASP LLM Top 10, or +Agentic AI Top 10).

**Architecture:** Backend streams typed SSE events (`message`, `analysis_triggered`, `analysis_complete`) over a new `POST /api/ai/threat-analysis/chat` endpoint. The LLM embeds `[ANALYSIS_CONTEXT:{...}]` in its response when ready; the backend strips it, submits a BullMQ job, and emits typed events — the frontend never parses text for markers. Full conversation saved to `ChatMessage` (layerId `__threat_analysis__`) and ChromaDB for resumability.

**Tech Stack:** NestJS 10 + BullMQ + LangChain (drafter-rest); Next.js 14 + React + SSE (drafter); ChromaDB for RAG indexing; Tailwind CSS for Copilot-style panel

---

> **Note on scope:** This plan covers two repos. Tasks 1–7 are backend (`drafter-rest`). Tasks 8–11 are frontend (`drafter`). Backend must be complete before frontend wiring (Task 10+). Tasks 8–9 can run in parallel with backend Tasks 4–7.

---

## File Map

### drafter-rest (backend)
| File | Action | Responsibility |
|---|---|---|
| `src/ai/prompts/threat-analysis-prompt.ts` | Modify | Add `THREAT_AGENT_SYSTEM_PROMPT`, `buildThreatAgentPrompt()`, `GENAI_THREAT_SYSTEM_PROMPT`, `AGENTIC_THREAT_SYSTEM_PROMPT` |
| `src/ai/dto/threat-chat.dto.ts` | Create | `ThreatChatDto` request shape |
| `src/ai/ai.service.ts` | Modify | Add `threatAgentChat()` SSE streaming method |
| `src/ai/ai.controller.ts` | Modify | Add `POST /ai/threat-analysis/chat` route |
| `src/jobs/processors/threat-analysis.processor.ts` | Modify | Accept `appType`+`confirmedCapabilities`, select prompt variant, return job result |
| `src/rag/rag-indexing.service.ts` | Modify | Add `indexThreatChatMessages()` |

### drafter (frontend)
| File | Action | Responsibility |
|---|---|---|
| `lib/api.ts` | Modify | Add `apiThreatAgentChat()` typed SSE generator |
| `components/AIChatPanel.tsx` | Modify | Copilot-style layout, threat agent mode, UI state machine |
| `components/DiagramPage.tsx` | Modify | Wire `onThreatAgentChat` + `initialThreatMessages`, load threat chat history |

---

## Task 1: New threat framework prompts

**Files:**
- Modify: `drafter-rest/src/ai/prompts/threat-analysis-prompt.ts`

- [ ] **Step 1: Add `THREAT_AGENT_SYSTEM_PROMPT` to the end of the prompts file**

Append after the existing exports:

```typescript
// ── Threat Agent: Agentic multi-turn classifier ─────────────────────────────

export const THREAT_AGENT_SYSTEM_PROMPT = `You are a security threat modeling agent embedded in an architecture diagramming tool.

YOUR ONLY GOAL is to produce a thorough, accurate threat analysis. You are not a general-purpose chatbot.

## Behavioral Rules
- Analyze the diagram the user provides, then ask AT MOST 3 targeted questions total before signaling readiness
- Never ask questions whose answers can be inferred from the diagram itself
- Questions must be goal-oriented: they must change which threats or frameworks you apply
- When you have sufficient context (after 0–3 questions), immediately signal readiness
- Do NOT summarize what you have learned or say "I'm ready" — just append the signal and stop

## Phase 1: Diagram Analysis
When you first receive a diagram:
1. Identify node types present: LLM/model nodes, vector databases, embedding services, agent/orchestrator nodes, external APIs, tool-use patterns
2. Classify the likely application type based on what you see:
   - STANDARD: no AI/ML nodes detected
   - GENAI: LLM/model nodes present, or vector DBs, or embedding services
   - AGENTIC: agent/orchestrator nodes, multi-service chains, tool-use patterns, autonomous decision nodes
3. Ask ONE focused question to confirm/correct your classification

## Phase 2: Targeted Follow-ups (max 2)
Ask follow-ups ONLY if the answer materially changes the threat surface:
- For GENAI: Is this RAG-based, fine-tuned, or calling an external LLM API? Are outputs passed to downstream systems without validation?
- For AGENTIC: Does the agent operate autonomously or with human-in-the-loop? What tools/permissions are granted? Is there inter-agent communication?
- For STANDARD: Are there any unlabeled AI integrations planned? Any sensitive PII data flows?

## Signaling Readiness
When you have enough context, append this EXACT token at the very end of your message (after your last sentence, on a new line, no trailing text):
[ANALYSIS_CONTEXT:{"appType":"<standard|genai|agentic>","confirmedCapabilities":["<capability1>","<capability2>"]}]

Example capabilities: "rag", "fine-tuned", "external-llm-api", "tool-use", "multi-agent", "human-in-loop", "code-execution", "autonomous", "output-to-downstream"

## After Analysis Is Triggered
Once analysis begins, switch to Q&A mode. Answer follow-up questions about specific threats concisely. Do not re-trigger analysis unless the user explicitly asks.`;

// ── Threat Agent: User message builder ──────────────────────────────────────

interface ThreatAgentInput {
  diagramSnapshot: {
    layerName: string;
    nodes: SerializedNode[];
    edges: SerializedEdge[];
    trustBoundaries: Array<{ id: string; label: string; trustLevel: string }>;
  };
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  appContext?: {
    appType: 'standard' | 'genai' | 'agentic';
    confirmedCapabilities: string[];
  };
}

export function buildThreatAgentPrompt(input: ThreatAgentInput): string {
  const lines: string[] = [];

  // Diagram snapshot — always included so LLM can reference specific nodes
  lines.push(`## Diagram: ${input.diagramSnapshot.layerName}`, '');

  if (input.diagramSnapshot.trustBoundaries.length > 0) {
    lines.push('### Trust Boundaries');
    for (const tb of input.diagramSnapshot.trustBoundaries) {
      lines.push(`- id="${tb.id}" label="${tb.label}" trustLevel="${tb.trustLevel}"`);
    }
    lines.push('');
  }

  lines.push('### Nodes');
  for (const n of input.diagramSnapshot.nodes) {
    const parts = [`- [${n.type}] id="${n.id}" label="${n.label}"`];
    if (n.technology) parts.push(`technology="${n.technology}"`);
    if (n.description) parts.push(`description="${n.description}"`);
    lines.push(parts.join(' '));
  }

  lines.push('', '### Data Flows');
  for (const e of input.diagramSnapshot.edges) {
    const label = e.label ? ` protocol="${e.label}"` : '';
    lines.push(`- from="${e.fromLabel}" to="${e.toLabel}"${label}`);
  }

  // Confirmed app context (injected once the LLM has confirmed)
  if (input.appContext) {
    lines.push('', `## Confirmed Application Context`);
    lines.push(`App Type: ${input.appContext.appType}`);
    lines.push(`Capabilities: ${input.appContext.confirmedCapabilities.join(', ')}`);
  }

  // Conversation history
  if (input.conversationHistory.length > 0) {
    lines.push('', '## Conversation So Far');
    for (const msg of input.conversationHistory) {
      lines.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`);
    }
  }

  lines.push('', 'Analyze the diagram and conversation above. Follow the behavioral rules in your system prompt.');
  return lines.join('\n');
}

// ── GenAI threat framework extension ────────────────────────────────────────

export const GENAI_THREAT_SYSTEM_PROMPT = THREAT_ANALYSIS_SYSTEM_PROMPT + `

## LLM-SPECIFIC THREAT CATEGORIES (OWASP Top 10 for LLM Applications 2026)

Apply these in addition to STRIDE when the application is GenAI or Agentic. Map each to the closest STRIDE category where possible, or use "LLM_SPECIFIC".

- **LLM01: Prompt Injection** — Attackers manipulate inputs to override system prompts, causing the model to ignore safety guardrails or execute malicious commands. Includes Direct Prompt Injection (jailbreaking) and Indirect Prompt Injection (via external data like websites or documents).
- **LLM02: Sensitive Information Disclosure** — LLMs may reveal proprietary data, PII, or system credentials memorized during training or present in the context window. Risk is heightened in fine-tuned models.
- **LLM03: Supply Chain Vulnerabilities** — Third-party base models, plugins, datasets, and fine-tuning adapters can be compromised. Backdoors can be planted directly into model weights and are difficult to detect.
- **LLM04: Data and Model Poisoning** — Adversaries tamper with data used in training, fine-tuning, or RAG knowledge bases to manipulate model behavior, introduce backdoors, or create bias.
- **LLM05: Improper Output Handling** — LLM outputs passed directly to downstream systems (code execution, SQL queries) without validation serve as an injection vector for RCE or XSS.
- **LLM06: Excessive Agency** — Agentic LLMs with high autonomy or granted too many permissions (file system, API access) can be manipulated into taking irreversible or destructive actions.
- **LLM07: System Prompt Leakage** — Attackers exploit vulnerabilities to extract hidden instructions defining the model's operation, persona, and constraints, enabling further attacks.
- **LLM08: Vector and Embedding Weaknesses** — RAG vector databases, if unsecured, allow attackers to manipulate the retrieval process to inject malicious context or bypass access controls.
- **LLM09: Misinformation (Overreliance)** — LLMs generate authoritative-sounding but false or biased content. Unchecked reliance leads to decision-making failures and reputational damage.
- **LLM10: Unbounded Consumption (Model DoS)** — Attackers consume excessive resources (computation, tokens) by triggering intensive operations, leading to high costs or service denial.

For each LLM-specific threat, include these additional fields in the JSON output:
- "owaspCategory": "LLM01" through "LLM10"
- "strideCategory": closest STRIDE mapping, or "LLM_SPECIFIC" if no direct mapping

Generate at least 3 LLM-specific threats where applicable.`;

// ── Agentic AI threat framework extension ───────────────────────────────────

export const AGENTIC_THREAT_SYSTEM_PROMPT = GENAI_THREAT_SYSTEM_PROMPT + `

## AGENTIC AI THREAT CATEGORIES (OWASP Top 10 for Agentic AI 2026)

Apply these in addition to STRIDE and LLM threats when the application has agent capabilities.

- **ASI01: Agent Goal Hijack** — Attackers manipulate instructions or inputs, causing the agent to abandon its intended purpose for malicious goals.
- **ASI02: Tool Misuse & Exploitation** — Agents are manipulated into using authorized tools (APIs, calculators, code executors) in destructive or unauthorized ways.
- **ASI03: Identity & Privilege Abuse** — Agents inherit excessive permissions or reuse stolen credentials to operate beyond authorized boundaries.
- **ASI04: Agentic Supply Chain Vulnerabilities** — Compromised third-party tools, plugins, or prompt templates infect the agent system.
- **ASI05: Unexpected Code Execution** — Agents generate and execute malicious code via natural language prompts, bypassing traditional security controls.
- **ASI06: Memory & Context Poisoning** — Long-term memory or RAG databases are corrupted with false information that the agent later acts on.
- **ASI07: Insecure Inter-Agent Communication** — Agents trust fraudulent messages from other agents, leading to spoofing or interception in multi-agent workflows.
- **ASI08: Cascading Failures** — A small error or breach in one agent triggers massive, systemic failures across multi-agent workflows.
- **ASI09: Human–Agent Trust Exploitation** — Humans over-rely on persuasive agents, leading to unauthorized or harmful approvals.
- **ASI10: Rogue Agents** — Agents diverge from designed goals due to misalignment or intentional compromise, operating autonomously in unpredictable ways.

For each Agentic-specific threat, include these additional fields in the JSON output:
- "owaspCategory": "ASI01" through "ASI10"
- "strideCategory": closest STRIDE mapping
- "agentScope": which agent node(s) in the diagram this threat applies to (by label)

Generate at least 3 Agentic-specific threats where applicable.`;

/** Select the correct system prompt based on confirmed application type */
export function selectThreatSystemPrompt(appType: 'standard' | 'genai' | 'agentic'): string {
  if (appType === 'agentic') return AGENTIC_THREAT_SYSTEM_PROMPT;
  if (appType === 'genai') return GENAI_THREAT_SYSTEM_PROMPT;
  return THREAT_ANALYSIS_SYSTEM_PROMPT;
}
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd /Users/sunil/Development/github/drafter-rest
npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors. Fix any type issues before proceeding.

- [ ] **Step 3: Commit**

```bash
cd /Users/sunil/Development/github/drafter-rest
git add src/ai/prompts/threat-analysis-prompt.ts
git commit -m "feat: add threat agent prompts — OWASP LLM10 + Agentic AI threat frameworks"
```

---

## Task 2: ThreatChatDto

**Files:**
- Create: `drafter-rest/src/ai/dto/threat-chat.dto.ts`

- [ ] **Step 1: Create the DTO file**

```typescript
// src/ai/dto/threat-chat.dto.ts
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MessageDto {
  @IsString()
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

class NodeInputDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  technology?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  trustLevel?: string;
}

class EdgeInputDto {
  @IsString()
  id: string;

  @IsString()
  source: string;

  @IsString()
  target: string;

  @IsOptional()
  @IsString()
  label?: string;
}

class TrustBoundaryInputDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  trustLevel?: string;
}

export class ThreatChatDto {
  @IsString()
  projectId: string;

  @IsString()
  diagramId: string;

  @IsString()
  layerId: string;

  @IsOptional()
  @IsString()
  layerName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeInputDto)
  nodes: NodeInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EdgeInputDto)
  edges: EdgeInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrustBoundaryInputDto)
  trustBoundaries?: TrustBoundaryInputDto[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/sunil/Development/github/drafter-rest
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/ai/dto/threat-chat.dto.ts
git commit -m "feat: add ThreatChatDto for threat agent endpoint"
```

---

## Task 3: `indexThreatChatMessages` in RagIndexingService

**Files:**
- Modify: `drafter-rest/src/rag/rag-indexing.service.ts`

- [ ] **Step 1: Add the method**

Append the following method inside the `RagIndexingService` class, after `indexChatMessages`:

```typescript
/**
 * Called after each threat agent conversation turn.
 * Indexes messages with conversationType='threat-analysis' for future RAG retrieval.
 */
async indexThreatChatMessages(
  projectId: string,
  userId: string,
  messages: ChatMessageItem[],
): Promise<void> {
  if (!this.chroma.isReady) return;

  try {
    const now = Date.now();
    const docs: RagDocument[] = messages
      .filter((m) => m.content.trim().length > 0)
      .map((m, i) => ({
        id: `threat_chat_${projectId}_${now}_${i}`,
        text: `[Threat Analysis ${m.role === 'user' ? 'User' : 'Agent'}]: ${m.content}`,
        metadata: {
          userId,
          projectId,
          diagramId: '',
          type: 'threat_chat_message',
          chatRole: m.role,
          layerId: '__threat_analysis__',
          layerName: 'Threat Analysis',
          conversationType: 'threat-analysis',
        },
      }));

    if (docs.length > 0) await this.chroma.upsert(docs);
  } catch (err) {
    this.logger.warn(`Failed to index threat chat messages: ${String(err)}`);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/sunil/Development/github/drafter-rest
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/rag/rag-indexing.service.ts
git commit -m "feat: add indexThreatChatMessages to RagIndexingService"
```

---

## Task 4: Enrich ThreatAnalysisProcessor with appType-based prompt selection

**Files:**
- Modify: `drafter-rest/src/jobs/processors/threat-analysis.processor.ts`

- [ ] **Step 1: Update imports at the top of the processor**

Replace the existing import block:
```typescript
import {
  THREAT_ANALYSIS_SYSTEM_PROMPT,
  buildThreatAnalysisPrompt,
} from '../../ai/prompts/threat-analysis-prompt';
```
with:
```typescript
import {
  buildThreatAnalysisPrompt,
  selectThreatSystemPrompt,
} from '../../ai/prompts/threat-analysis-prompt';
```

- [ ] **Step 2: Add `appType` and `confirmedCapabilities` to `ThreatAnalysisJobPayload`**

Replace:
```typescript
export interface ThreatAnalysisJobPayload {
  aiJobId: string;
  userId: string;
  dto: SubmitThreatAnalysisDto;
}
```
with:
```typescript
export interface ThreatAnalysisJobPayload {
  aiJobId: string;
  userId: string;
  dto: SubmitThreatAnalysisDto;
  appType?: 'standard' | 'genai' | 'agentic';
  confirmedCapabilities?: string[];
}

export interface ThreatAnalysisJobResult {
  modelId: string;
  threatCount: number;
  summary: string;
  keyFindings: Array<{ category: string; count: number; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' }>;
}
```

- [ ] **Step 3: Update the `process` method to use `selectThreatSystemPrompt` and return a result**

Replace the line:
```typescript
const { content } = await this.llm.invoke(THREAT_ANALYSIS_SYSTEM_PROMPT, userMessage, llmConfig);
```
with:
```typescript
const systemPrompt = selectThreatSystemPrompt(job.data.appType ?? 'standard');
const { content } = await this.llm.invoke(systemPrompt, userMessage, llmConfig);
```

Then change the `process` method signature from `Promise<void>` to `Promise<ThreatAnalysisJobResult>` and replace the final success block:

```typescript
      // Build summary + key findings for SSE result
      const severityGroups = new Map<string, Map<string, number>>();
      for (const t of threats) {
        const owaspCat = (t.owaspCategory as string | undefined) ?? (t.strideCategory as string);
        const sev = t.severity as string;
        if (!severityGroups.has(owaspCat)) severityGroups.set(owaspCat, new Map());
        severityGroups.get(owaspCat)!.set(sev, (severityGroups.get(owaspCat)!.get(sev) ?? 0) + 1);
      }
      const keyFindings: ThreatAnalysisJobResult['keyFindings'] = [];
      for (const [cat, sevMap] of severityGroups.entries()) {
        const topSev = (['CRITICAL', 'HIGH', 'MEDIUM'] as const).find((s) => sevMap.has(s));
        if (topSev) {
          keyFindings.push({ category: cat, count: sevMap.get(topSev)!, severity: topSev });
        }
      }
      keyFindings.sort((a, b) => {
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
        return order[a.severity] - order[b.severity];
      });

      const result: ThreatAnalysisJobResult = {
        modelId: saved!.id,
        threatCount: threats.length,
        summary: `Found ${threats.length} threat${threats.length !== 1 ? 's' : ''} using ${job.data.appType === 'agentic' ? 'STRIDE + OWASP LLM10 + Agentic AI Top 10' : job.data.appType === 'genai' ? 'STRIDE + OWASP LLM Top 10' : 'STRIDE + CISSP'}.`,
        keyFindings: keyFindings.slice(0, 5),
      };

      await this.prisma.aiJob.update({
        where: { id: aiJobId },
        data: {
          status: AiJobStatus.COMPLETED,
          resultRef: saved!.id,
          progress: 100,
          completedAt: new Date(),
        },
      });

      this.logger.log(`[ThreatAnalysis] job=${aiJobId} completed, threatModelId=${saved!.id}, threats=${threats.length}`);
      return result;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/sunil/Development/github/drafter-rest
npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/jobs/processors/threat-analysis.processor.ts
git commit -m "feat: threat processor selects OWASP LLM10/Agentic prompt by appType, returns structured result"
```

---

## Task 5: `threatAgentChat` service method

**Files:**
- Modify: `drafter-rest/src/ai/ai.service.ts`

- [ ] **Step 1: Add imports at the top of `ai.service.ts`**

Add to the existing import from the prompts file:
```typescript
import {
  THREAT_ANALYSIS_SYSTEM_PROMPT,
  buildThreatAnalysisPrompt,
  THREAT_AGENT_SYSTEM_PROMPT,
  buildThreatAgentPrompt,
  selectThreatSystemPrompt,
} from './prompts/threat-analysis-prompt';
```

Add to the jobs-related imports:
```typescript
import { QueueEvents } from 'bullmq';
import { ThreatAnalysisJobPayload, ThreatAnalysisJobResult } from '../jobs/processors/threat-analysis.processor';
```

Also import `ThreatChatDto`:
```typescript
import { ThreatChatDto } from './dto/threat-chat.dto';
```

- [ ] **Step 2: Add the `threatAgentChat` method to `AiService`**

Add after the existing `threatAnalysis` method (around line 390):

```typescript
// ── Threat Agent Chat (multi-turn, typed SSE) ────────────────────────────────

async threatAgentChat(userId: string, dto: ThreatChatDto, res: Response): Promise<void> {
  const ANALYSIS_CONTEXT_RE = /\[ANALYSIS_CONTEXT:(\{[^}]+\})\]/s;

  // ── SSE helpers ────────────────────────────────────────────────────────────
  const writeEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // ── Serialize diagram for prompt ───────────────────────────────────────────
  const nodeLabelMap = new Map<string, string>();
  const serializedNodes = dto.nodes
    .filter((n) => n.type !== 'trustboundary')
    .map((n) => {
      const label = n.label ?? n.id;
      nodeLabelMap.set(n.id, label);
      return { id: n.id, type: n.type ?? 'unknown', label, technology: n.technology, description: n.description };
    });

  const serializedEdges = dto.edges.map((e) => ({
    id: e.id,
    from: e.source,
    to: e.target,
    fromLabel: nodeLabelMap.get(e.source) ?? e.source,
    toLabel: nodeLabelMap.get(e.target) ?? e.target,
    label: e.label,
  }));

  const trustBoundaries = (dto.trustBoundaries ?? []).map((tb) => ({
    id: tb.id,
    label: tb.label ?? 'Trust Boundary',
    trustLevel: tb.trustLevel ?? 'custom',
  }));

  const userMessage = buildThreatAgentPrompt({
    diagramSnapshot: {
      layerName: dto.layerName ?? 'Diagram',
      nodes: serializedNodes,
      edges: serializedEdges,
      trustBoundaries,
    },
    conversationHistory: dto.messages,
  });

  // ── Stream LLM response ────────────────────────────────────────────────────
  const llmConfig = await this.buildLlmConfig(userId);
  const resolvedProvider = llmConfig.provider ?? this.llm.provider;
  const resolvedModel = llmConfig.model ?? this.llm.modelName;
  let fullResponse = '';

  try {
    for await (const chunk of this.llm.streamConversation(
      THREAT_AGENT_SYSTEM_PROMPT,
      dto.messages,
      userMessage,
      llmConfig,
    )) {
      // Strip [ANALYSIS_CONTEXT] from streamed text before sending to client
      const visible = chunk.replace(ANALYSIS_CONTEXT_RE, '');
      if (visible) writeEvent('message', { delta: visible });
      fullResponse += chunk;
    }
    writeEvent('message_done', {});

    // ── Detect analysis trigger ────────────────────────────────────────────
    const ctxMatch = fullResponse.match(ANALYSIS_CONTEXT_RE);
    const cleanResponse = fullResponse.replace(ANALYSIS_CONTEXT_RE, '').trim();

    // Persist both user turn + assistant response
    const lastUserMsg = dto.messages[dto.messages.length - 1];
    const persistMessages = lastUserMsg?.role === 'user'
      ? [{ role: 'user' as const, content: lastUserMsg.content }]
      : [];
    persistMessages.push({ role: 'assistant' as const, content: cleanResponse });

    if (dto.projectId) {
      await this.chat.saveMessages(dto.projectId, userId, persistMessages.map((m) => ({
        ...m,
        layerId: '__threat_analysis__',
        layerName: 'Threat Analysis',
        provider: resolvedProvider,
        model: resolvedModel,
      })));
      // Non-blocking ChromaDB indexing
      this.ragIndexing.indexThreatChatMessages(dto.projectId, userId, persistMessages).catch(() => {});
    }

    // ── Submit background job if context signal found ──────────────────────
    if (ctxMatch) {
      let appContext: { appType: 'standard' | 'genai' | 'agentic'; confirmedCapabilities: string[] };
      try {
        appContext = JSON.parse(ctxMatch[1]) as typeof appContext;
      } catch {
        appContext = { appType: 'standard', confirmedCapabilities: [] };
      }

      // Create AiJob record
      const aiJob = await this.prisma.aiJob.create({
        data: {
          userId,
          projectId: dto.projectId,
          diagramId: dto.diagramId,
          jobType: 'THREAT_ANALYSIS' as const,
          status: 'PENDING' as const,
        },
      });

      const jobPayload: ThreatAnalysisJobPayload = {
        aiJobId: aiJob.id,
        userId,
        appType: appContext.appType,
        confirmedCapabilities: appContext.confirmedCapabilities,
        dto: {
          projectId: dto.projectId,
          diagramId: dto.diagramId,
          diagramVersion: 0, // processor resolves actual version from DB via prisma.diagram.findUnique({ where: { id: dto.diagramId } })
          layerId: dto.layerId,
          layerName: dto.layerName,
          modelName: `Threat Analysis — ${dto.layerName ?? dto.layerId}`,
          nodes: dto.nodes.map((n) => ({
            id: n.id, type: n.type, label: n.label, technology: n.technology,
            description: n.description, trustLevel: n.trustLevel,
          })),
          edges: dto.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
          trustBoundaries: dto.trustBoundaries,
        },
      };

      const job = await this.threatQueue.add('run', jobPayload, { removeOnComplete: 100, removeOnFail: 50 });
      writeEvent('analysis_triggered', { jobId: job.id });

      // Wait for job completion (SSE connection stays open; 120s timeout)
      try {
        const queueEvents = new QueueEvents(THREAT_ANALYSIS_QUEUE, {
          connection: (this.threatQueue as any).opts?.connection,
        });
        const result = await job.waitUntilFinished(queueEvents, 120_000) as ThreatAnalysisJobResult;
        await queueEvents.close();
        writeEvent('analysis_complete', result);
      } catch (waitErr) {
        this.logger.warn(`[ThreatAgent] job wait failed: ${String(waitErr)}`);
        writeEvent('analysis_complete', {
          modelId: '',
          threatCount: 0,
          summary: 'Analysis completed. Open the Threat Model Panel (⌘⇧M) to view results.',
          keyFindings: [],
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`[ThreatAgent] error: ${message}`);
    writeEvent('error', { message: 'Analysis failed. Please try again.' });
  } finally {
    res.end();
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/sunil/Development/github/drafter-rest
npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors. The `AiJobType` enum from Prisma must include `THREAT_ANALYSIS` — if it doesn't, check `src/prisma/schema.prisma` and run `npm run db:generate` after adding it. If the field already exists in an existing `AiJobType` enum, use the existing value.

- [ ] **Step 4: Commit**

```bash
git add src/ai/ai.service.ts
git commit -m "feat: add threatAgentChat SSE method with phase detection and job submission"
```

---

## Task 6: Wire endpoint in AiController

**Files:**
- Modify: `drafter-rest/src/ai/ai.controller.ts`

- [ ] **Step 1: Add the import and route**

Add to the imports at the top:
```typescript
import { ThreatChatDto } from './dto/threat-chat.dto';
```

Add the route after the existing `threatAnalysis` route:

```typescript
@Post('threat-analysis/chat')
threatAgentChat(
  @CurrentUser('id') userId: string,
  @Body() dto: ThreatChatDto,
  @Res() res: Response,
) {
  return this.ai.threatAgentChat(userId, dto, res);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/sunil/Development/github/drafter-rest
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Start the server and confirm route is registered**

```bash
npm run start:dev 2>&1 | grep -E "threat|POST" | head -10
```
Expected: lines showing `POST /api/ai/threat-analysis/chat` mapped.

- [ ] **Step 4: Commit**

```bash
git add src/ai/ai.controller.ts
git commit -m "feat: register POST /ai/threat-analysis/chat endpoint"
```

---

## Task 7: Manual backend smoke test

- [ ] **Step 1: Start the server**

```bash
cd /Users/sunil/Development/github/drafter-rest
npm run start:dev
```

- [ ] **Step 2: Test the endpoint with curl (requires a valid JWT token)**

Replace `YOUR_JWT_TOKEN` with a token from a logged-in session:

```bash
curl -N -X POST http://localhost:4000/api/ai/threat-analysis/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "projectId": "test-project",
    "diagramId": "test-diagram",
    "layerId": "root",
    "layerName": "Main Layer",
    "messages": [],
    "nodes": [
      {"id":"n1","type":"service","label":"API Gateway"},
      {"id":"n2","type":"database","label":"User DB"},
      {"id":"n3","type":"service","label":"LLM Service"}
    ],
    "edges": [
      {"id":"e1","source":"n1","target":"n2"},
      {"id":"e2","source":"n1","target":"n3"}
    ],
    "trustBoundaries": []
  }' 2>&1 | head -40
```

Expected: SSE stream with `event: message` events containing delta text, followed by `event: message_done`.

The response should contain a question about the LLM Service node (GenAI classification).

---

## Task 8: `apiThreatAgentChat` in lib/api.ts

**Files:**
- Modify: `drafter/lib/api.ts`

- [ ] **Step 1: Add type definitions and the streaming function**

Append to `lib/api.ts` (after the existing threat model functions):

```typescript
// ─── Threat Agent Chat ────────────────────────────────────────────────────────

export interface ThreatChatPayload {
  projectId: string;
  diagramId: string;
  layerId: string;
  layerName?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  nodes: Array<{
    id: string; type?: string; label?: string;
    technology?: string; description?: string; trustLevel?: string;
  }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
  trustBoundaries?: Array<{ id: string; label?: string; trustLevel?: string }>;
}

export interface KeyFinding {
  category: string;
  count: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export type ThreatChatEvent =
  | { type: 'message'; delta: string }
  | { type: 'message_done' }
  | { type: 'analysis_triggered'; jobId: string }
  | { type: 'analysis_complete'; modelId: string; threatCount: number; summary: string; keyFindings: KeyFinding[] }
  | { type: 'error'; message: string };

/**
 * Multi-turn threat agent chat — streams typed SSE events.
 * Backend handles phase detection, job submission, and ChromaDB indexing.
 *
 * Usage:
 *   for await (const event of apiThreatAgentChat(payload)) { ... }
 */
export async function* apiThreatAgentChat(
  payload: ThreatChatPayload,
): AsyncGenerator<ThreatChatEvent> {
  const res = await fetchWithRefresh(`${BASE_URL}/api/ai/threat-analysis/chat`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    yield { type: 'error', message: `HTTP ${res.status}` };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    yield { type: 'error', message: 'No response stream' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE frames: "event: <name>\ndata: <json>\n\n"
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      if (!frame.trim()) continue;
      const lines = frame.split('\n');
      let eventName = 'message';
      let dataLine = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) eventName = line.slice('event: '.length).trim();
        if (line.startsWith('data: ')) dataLine = line.slice('data: '.length).trim();
      }
      if (!dataLine) continue;
      try {
        const parsed = JSON.parse(dataLine) as Record<string, unknown>;
        if (eventName === 'message') yield { type: 'message', delta: parsed.delta as string };
        else if (eventName === 'message_done') yield { type: 'message_done' };
        else if (eventName === 'analysis_triggered') yield { type: 'analysis_triggered', jobId: parsed.jobId as string };
        else if (eventName === 'analysis_complete') yield {
          type: 'analysis_complete',
          modelId: parsed.modelId as string,
          threatCount: parsed.threatCount as number,
          summary: parsed.summary as string,
          keyFindings: parsed.keyFindings as KeyFinding[],
        };
        else if (eventName === 'error') yield { type: 'error', message: parsed.message as string };
      } catch {
        // Malformed frame — skip
      }
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/sunil/Development/github/drafter
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/api.ts
git commit -m "feat: add apiThreatAgentChat typed SSE generator"
```

---

## Task 9: AIChatPanel — Copilot-style redesign + threat agent mode

**Files:**
- Modify: `drafter/components/AIChatPanel.tsx`

This is the largest frontend task. Work through it in three sub-steps.

### 9a — New types and state

- [ ] **Step 1: Add new types and state at the top of the component**

After the existing `Message` interface, add:

```typescript
type ThreatAgentPhase = 'idle' | 'diagnosing' | 'conversing' | 'analyzing' | 'complete';

interface ThreatAgentMessage {
  role: 'user' | 'assistant' | 'system-event';
  content: string;
  isLoading?: boolean;
  phase?: ThreatAgentPhase;
  analysisResult?: {
    modelId: string;
    threatCount: number;
    summary: string;
    keyFindings: KeyFinding[];
  };
}
```

Add to `AIChatPanelProps`:
```typescript
onThreatAgentChat?: (payload: ThreatChatPayload) => AsyncGenerator<ThreatChatEvent>;
initialThreatMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
/** Current layer's nodes (for threat agent serialization) */
currentNodes?: unknown[];
/** Current layer's edges (for threat agent serialization) */
currentEdges?: unknown[];
/** Current layer's trust boundaries */
currentTrustBoundaries?: unknown[];
```

Add to component state block:
```typescript
const [threatPhase, setThreatPhase] = useState<ThreatAgentPhase>('idle');
const [threatMessages, setThreatMessages] = useState<ThreatAgentMessage[]>(() =>
  (initialThreatMessages ?? []).map((m) => ({ role: m.role, content: m.content })),
);
const [threatInput, setThreatInput] = useState('');
const threatMessagesEndRef = useRef<HTMLDivElement>(null);
const threatStreamRef = useRef('');
```

Also add the `KeyFinding` and `ThreatChatPayload` imports from `@/lib/api`:
```typescript
import type { ThreatItem, KeyFinding, ThreatChatPayload, ThreatChatEvent } from '@/lib/api';
```

- [ ] **Step 2: Commit this state addition before moving on**

```bash
cd /Users/sunil/Development/github/drafter
npx tsc --noEmit 2>&1 | head -20
git add components/AIChatPanel.tsx
git commit -m "feat: add threat agent types and state to AIChatPanel"
```

### 9b — Threat agent handler

- [ ] **Step 3: Add `runThreatAgentChat` handler**

Add after the existing `runThreatAnalysis` function:

```typescript
// ── Threat Agent Chat ─────────────────────────────────────────────────────
const pushThreatMsg = (msg: ThreatAgentMessage) =>
  setThreatMessages((prev) => [...prev, msg]);

const replaceLastThreatMsg = (msg: ThreatAgentMessage) =>
  setThreatMessages((prev) => {
    const updated = [...prev];
    updated[updated.length - 1] = msg;
    return updated;
  });

const runThreatAgentChat = async (userContent?: string) => {
  if (!onThreatAgentChat || !projectId || !hasNodes) return;

  // Append user message to history first
  const updatedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...threatMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];
  if (userContent) {
    pushThreatMsg({ role: 'user', content: userContent });
    updatedHistory.push({ role: 'user', content: userContent });
  }

  setThreatPhase(updatedHistory.length === 0 ? 'diagnosing' : 'conversing');
  pushThreatMsg({ role: 'assistant', content: '', isLoading: true });

  threatStreamRef.current = '';

  const payload: ThreatChatPayload = {
    projectId,
    diagramId: projectId, // DiagramPage will pass actual diagramId via prop — for now use projectId as fallback
    layerId: 'root',
    messages: updatedHistory,
    nodes: (currentNodes ?? []) as ThreatChatPayload['nodes'],
    edges: (currentEdges ?? []) as ThreatChatPayload['edges'],
    trustBoundaries: (currentTrustBoundaries ?? []) as ThreatChatPayload['trustBoundaries'],
  };

  try {
    for await (const event of onThreatAgentChat(payload)) {
      if (event.type === 'message') {
        threatStreamRef.current += event.delta;
        const content = threatStreamRef.current;
        setThreatMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content };
          return updated;
        });
        setThreatPhase('conversing');
      } else if (event.type === 'analysis_triggered') {
        replaceLastThreatMsg({
          role: 'system-event',
          content: 'Threat analysis running in background…',
          phase: 'analyzing',
        });
        setThreatPhase('analyzing');
        pushThreatMsg({ role: 'assistant', content: '', isLoading: true });
      } else if (event.type === 'analysis_complete') {
        replaceLastThreatMsg({
          role: 'assistant',
          content: event.summary,
          analysisResult: {
            modelId: event.modelId,
            threatCount: event.threatCount,
            summary: event.summary,
            keyFindings: event.keyFindings,
          },
        });
        setThreatPhase('complete');
      } else if (event.type === 'error') {
        replaceLastThreatMsg({ role: 'assistant', content: event.message });
        setThreatPhase('idle');
      }
    }
  } catch {
    replaceLastThreatMsg({ role: 'assistant', content: 'Something went wrong. Please try again.' });
    setThreatPhase('idle');
  }
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/sunil/Development/github/drafter
npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/AIChatPanel.tsx
git commit -m "feat: add runThreatAgentChat handler with SSE event loop"
```

### 9c — Copilot-style threat panel UI

- [ ] **Step 6: Add the threat agent panel render section**

Inside the main `return` of `AIChatPanel`, the panel currently renders as a narrow `w-[360px]` aside. Change the outer `aside` class to:
```tsx
<aside className="relative flex h-full w-[420px] flex-shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
```

Add a new render section for threat mode — when `showHistory` is false and `onThreatAgentChat` is provided, show the threat panel **as a tab** within the panel. Add this tab switcher just below the header `div`:

```tsx
{onThreatAgentChat && (
  <div className="flex flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
    <button
      onClick={() => setShowThreatTab(false)}
      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${!showThreatTab ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
    >
      AI Assistant
    </button>
    <button
      onClick={() => setShowThreatTab(true)}
      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${showThreatTab ? 'border-b-2 border-red-500 text-red-600 dark:text-red-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
    >
      🛡 Threat Analysis
    </button>
  </div>
)}
```

Add `const [showThreatTab, setShowThreatTab] = useState(false);` to the state block.

Add the threat panel body — insert this block inside the main return, conditionally rendered when `showThreatTab`:

```tsx
{showThreatTab && onThreatAgentChat && (
  <div className="flex flex-1 flex-col overflow-hidden">
    {/* Resume header */}
    {threatMessages.length > 0 && threatPhase === 'idle' && (
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <span>🛡 Previous session</span>
        <button
          onClick={() => { setThreatMessages([]); setThreatPhase('idle'); }}
          className="ml-auto rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-700"
        >
          + New
        </button>
      </div>
    )}

    {/* Messages */}
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {threatMessages.length === 0 && threatPhase === 'idle' && (
        <div className="flex flex-col items-center justify-center h-full gap-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-200 dark:bg-slate-700 dark:ring-slate-600">
            <ShieldAlert size={22} className="text-red-500 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Threat Intelligence</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-[280px]">
              Analyzes your diagram and asks a few questions to apply the right threat framework — STRIDE, OWASP LLM Top 10, or Agentic AI.
            </p>
          </div>
        </div>
      )}

      {threatMessages.map((msg, i) => (
        <div key={i}>
          {msg.role === 'system-event' ? (
            /* Phase timeline divider */
            <div className="flex items-center gap-2 py-2">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Loader2 size={10} className={msg.phase === 'analyzing' ? 'animate-spin' : ''} />
                {msg.content}
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>
          ) : msg.role === 'user' ? (
            /* User bubble — right aligned */
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                {msg.content}
              </div>
            </div>
          ) : (
            /* Assistant bubble — left aligned */
            <div className="flex gap-2">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-200 dark:bg-slate-700 dark:ring-slate-600">
                <ShieldAlert size={12} className="text-red-500 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                {msg.isLoading ? (
                  <ThinkingDots label="Analyzing…" />
                ) : msg.analysisResult ? (
                  /* Analysis result card */
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/20">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
                      🛡 {msg.analysisResult.threatCount} threats identified
                    </p>
                    <div className="space-y-1 mb-3">
                      {msg.analysisResult.keyFindings.slice(0, 5).map((f, fi) => (
                        <div key={fi} className="flex items-center gap-2 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.severity === 'CRITICAL' ? 'bg-red-500' : f.severity === 'HIGH' ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                          <span className="text-slate-700 dark:text-slate-300">{f.category} — {f.count} threat{f.count !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => onSaveThreatModel && onSaveThreatModel('Threat Analysis', [])}
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-medium"
                    >
                      View full model → (⌘⇧M)
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      <div ref={threatMessagesEndRef} />
    </div>

    {/* Input area */}
    <div className="flex-shrink-0 border-t border-slate-200 px-3 py-2 dark:border-slate-700">
      {threatPhase === 'idle' && threatMessages.length === 0 ? (
        /* Primary CTA */
        <button
          onClick={() => runThreatAgentChat()}
          disabled={!hasNodes}
          className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Analyze Threats
        </button>
      ) : threatPhase === 'analyzing' ? (
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-2">
          Analysis running… please wait
        </div>
      ) : threatPhase === 'complete' ? (
        /* Post-analysis chips */
        <div className="flex gap-2">
          <button
            onClick={() => runThreatAgentChat()}
            className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Re-analyze
          </button>
          <button
            onClick={() => setShowThreatTab(false)}
            className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Evaluate Architecture
          </button>
        </div>
      ) : (
        /* Chat input */
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={threatInput}
            onChange={(e) => setThreatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (threatInput.trim() && threatPhase !== 'analyzing') {
                  const val = threatInput.trim();
                  setThreatInput('');
                  runThreatAgentChat(val);
                }
              }
            }}
            placeholder="Reply to the agent… (Enter to send)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-red-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <button
            onClick={() => {
              if (threatInput.trim()) {
                const val = threatInput.trim();
                setThreatInput('');
                runThreatAgentChat(val);
              }
            }}
            disabled={!threatInput.trim() || threatPhase === 'analyzing'}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 7: Add scroll effect for threat messages**

Add alongside the existing `messagesEndRef` scroll effect:
```typescript
useEffect(() => {
  threatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [threatMessages]);
```

- [ ] **Step 8: Verify TypeScript compiles, fix any issues**

```bash
cd /Users/sunil/Development/github/drafter
npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add components/AIChatPanel.tsx
git commit -m "feat: copilot-style threat agent panel UI — tabs, timeline markers, result card"
```

---

## Task 10: Wire threat agent in DiagramPage

**Files:**
- Modify: `drafter/components/DiagramPage.tsx`

- [ ] **Step 1: Read the existing `onThreatAnalysis` wiring in DiagramPage**

Check how `onThreatAnalysis` is currently passed to `AIChatPanel`:

```bash
cd /Users/sunil/Development/github/drafter
grep -n "onThreatAnalysis\|apiThreatAnalysis\|initialMessages\|AIChatPanel" components/DiagramPage.tsx | head -20
```

- [ ] **Step 2: Add imports**

Add to the imports in `DiagramPage.tsx`:
```typescript
import {
  apiThreatAgentChat,
  type ThreatChatPayload,
  type ThreatChatEvent,
} from '@/lib/api';
```

- [ ] **Step 3: Add handler for threat agent chat**

Find the section where `onThreatAnalysis` callback is defined and add the new handler alongside it:

```typescript
const handleThreatAgentChat = useCallback(
  async function* (payload: ThreatChatPayload): AsyncGenerator<ThreatChatEvent> {
    yield* apiThreatAgentChat(payload);
  },
  [],
);
```

- [ ] **Step 4: Load threat chat history**

Find where `initialMessages` is fetched for the AI chat panel (the `GET /api/projects/:id/chat` call). Add filtering for threat messages:

```typescript
// After loading chatHistory from backend:
const threatHistory = (chatHistory ?? [])
  .filter((m: { layerId?: string }) => m.layerId === '__threat_analysis__')
  .map((m: { role: 'user' | 'assistant'; content: string }) => ({
    role: m.role,
    content: m.content,
  }));
```

- [ ] **Step 5: Pass props to AIChatPanel**

Add the following props to the `<AIChatPanel>` JSX:
```tsx
onThreatAgentChat={backendDiagramId ? handleThreatAgentChat : undefined}
initialThreatMessages={threatHistory}
currentNodes={nodes}
currentEdges={edges}
```

Where `nodes` and `edges` are the current React Flow node/edge arrays from canvas state. Check the exact variable names used in `DiagramPage.tsx` (`rfNodes`, `currentNodes`, etc.) via grep and use those exact names.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/sunil/Development/github/drafter
npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add components/DiagramPage.tsx
git commit -m "feat: wire threatAgentChat + threat history into AIChatPanel"
```

---

## Task 11: End-to-end verification

- [ ] **Step 1: Run the frontend build**

```bash
cd /Users/sunil/Development/github/drafter
npm run build 2>&1 | tail -20
```
Expected: Build completes with 0 errors.

- [ ] **Step 2: Run the backend build**

```bash
cd /Users/sunil/Development/github/drafter-rest
npx tsc --noEmit 2>&1 | head -10
```
Expected: 0 errors.

- [ ] **Step 3: Manual E2E test (both servers running)**

Start backend:
```bash
cd /Users/sunil/Development/github/drafter-rest && npm run start:dev
```
Start frontend:
```bash
cd /Users/sunil/Development/github/drafter && npm run dev
```

Test flow:
1. Open a project with nodes on the canvas
2. Open AI panel (⌘I)
3. Switch to "🛡 Threat Analysis" tab
4. Click "Analyze Threats"
5. Verify: ThinkingDots appear, then an assistant message with a question about node types
6. Reply to the question
7. Verify: follow-up or analysis trigger
8. If analysis triggered: verify inline progress divider, then result card with key findings
9. Close and re-open panel — verify previous session is shown with "Previous session / + New" header
10. Click "+ New" — verify thread clears

- [ ] **Step 4: Test GenAI classification**

Add an LLM node (e.g. "Claude API") to the canvas and repeat steps 4–8. Verify the result card summary mentions "OWASP LLM Top 10".

- [ ] **Step 5: Commit final state**

```bash
cd /Users/sunil/Development/github/drafter
git add -A
git commit -m "feat: threat analysis agent chat — end-to-end working"
```
