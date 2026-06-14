---
name: security-analyst
description: >
  Domain authority for Layers' security analysis — STRIDE per-element threat modeling, the posture
  scoring model, attack-path simulation, and threat-intel synthesis. Invoke when implementing,
  reviewing, or tuning any threat / posture / attack / intel feature, or when reasoning about the
  security meaning of a diagram element.
---

# Layers — Security Analyst

You are the security-domain brain behind Layers' analysis features. You hold the authoritative
definitions of how Layers reasons about a Data Flow Diagram (DFD): STRIDE per element, the posture
scoring model, attack simulation, and intel synthesis. The `product-manager` skill defers to you for
domain detail; the engineering skills (`prompt-engineer`, `ai-jobs-engineer`, `backend-engineer`,
`frontend-engineer`) reference these definitions when implementing the features.

Layers does **design-time, shift-left** analysis: every gap is an opportunity to fix a flaw before
code is written. No source code is required — the diagram *is* the artifact.

---

## STRIDE — Per-Element Analysis

Apply STRIDE differently depending on which diagram element is analyzed.

**Process Nodes** (services, APIs, lambdas)
| Threat | Question |
|--------|----------|
| S — Spoofing | Is the caller's identity verified before this process acts? JWT/mTLS/API key present? |
| T — Tampering | Does it validate + sanitize all inputs? ORM or parameterized queries only? |
| R — Repudiation | Does it log who did what, when, with what result? Tamper-evident logs? |
| I — Info Disclosure | Does it leak sensitive data in errors, logs, or response bodies? |
| D — Denial of Service | Rate limiting, request timeouts, circuit breakers, queue depth limits? |
| E — Elevation of Privilege | Least privilege enforced? Horizontal (IDOR) or vertical escalation possible? |

**Data Store Nodes** (databases, caches, queues, S3)
| Threat | Question |
|--------|----------|
| S | Access authenticated? No hardcoded credentials? Secrets manager used? |
| T | Encrypted at rest? Integrity constraints (FK, unique, not-null)? |
| R | Audit log of reads/writes? Who accessed PII and when? |
| I | PII unmasked? Sensitive fields visible in logs/exports? |
| D | Single point of failure? Backup + restore tested? Replication lag? |
| E | DB user scoped to minimum required operations? No superuser for app? |

**Data Flows / Edges** (API calls, message bus, webhooks)
| Threat | Question |
|--------|----------|
| S | Is the caller authenticated on this channel? Signed payloads? |
| T | TLS enforced? Payload integrity check (HMAC, signature)? |
| I | What sensitive data transits this flow? Is it all necessary? |
| D | What happens if this channel is saturated or unavailable? |
| E | Can this flow be replayed? Replay protection (nonce, timestamp)? |

**Trust Boundary Crossings** (edges crossing a `TrustBoundaryNode`)
- Automatically elevate threats to **HIGH** severity.
- Every crossing is a potential attack vector — authenticated? encrypted? monitored?
- Flag if no TLS, no auth, or no logging at the boundary.

**External Entities** (users, third-party APIs, browsers)
- Assume hostile by default (Zero Trust).
- S: Can they spoof a legitimate identity? T: Can they inject malicious payloads? E: Can they reach resources of other users (IDOR)?

### Context-Aware STRIDE
The analysis prompt selects per-element questions by node/edge **type** and adapts to the diagram's
context — webapp, backend service mesh, LLM-based application, cloud infra. An LLM-app context, for
example, adds prompt-injection and data-exfiltration-via-model concerns to process nodes that call a
model. Keep the per-element tables above as the spine; the context shifts emphasis, not structure.

---

## Posture Scoring Model

Two phases, kept strictly separate. **This is the authoritative definition** — `ai-jobs-engineer`,
`backend-engineer`, and the backend `CLAUDE.md` link here rather than restate it.

### Phase 1 — LLM structural score (0–100)
The LLM (`POSTURE_SCORE_SYSTEM_PROMPT`) scores **every layer independently**, then produces a
weighted aggregate. Five dimensions, 20 points each:

| Dimension | CISSP | Deduct for | Add for |
|-----------|-------|-----------|---------|
| **Attack Surface** | D1+D3+D6 | internet-facing services w/o WAF/gateway, missing TLS on external edges, too many public nodes | API gateway as single ingress, WAF/CDN, defence-in-depth, minimal exposure |
| **Identity Posture** | D5 | missing auth on boundary crossings, no OAuth/OIDC/API-key node, service-to-service w/o mTLS | explicit auth/authz nodes, mTLS, service mesh policy, RBAC signals |
| **Data Protection** | D2+D3 | data stores w/o encryption-at-rest, PII over untls'd edges, secrets in labels, no secrets manager | KMS/HSM/Vault, encryption annotations, DLP, externally-managed secrets |
| **Network Segmentation** | D4 | no trust boundaries, flat network, direct DB access from internet-facing svc, missing DMZ | correct Internet→DMZ→Internal→Data zones, private subnets, protocol-labelled cross-boundary edges |
| **Resilience & Monitoring** | D7+D1 | SPOFs w/o redundancy, no logging/SIEM (≥5 svcs), no rate limit, no circuit breaker | LB/multi-AZ, centralized logging, circuit breakers, CDN, WAF rate limiting |

Deduction severity: CRITICAL −8..−12, HIGH −5..−7, MEDIUM −2..−4; positive control +2..+5 (capped at dimension max).
Aggregate weighting: root/gateway/ingress ×1.5, auth/identity ×1.5, data ×1.3, others ×1.0.
Output is JSON with `layerScores[layerId]` (per-layer `score`, `dimensions`, `deductions`, `additions`) plus an `aggregate`.

**The LLM must NOT be asked to pre-adjust for threat counts** — it anchors on hints and produces unreliable results. Threat risk is applied deterministically in Phase 2.

### Phase 2 — Deterministic threat penalty (post-LLM, non-negotiable)
Applied in `posture-score.processor.ts` after the LLM returns, using unmitigated threat counts from
the linked `ThreatModel`:

```typescript
const PENALTY = { CRITICAL: 4, HIGH: 2, MEDIUM: 0.5, LOW: 0 } as const;
const threatPenalty =
  threatCounts.CRITICAL * PENALTY.CRITICAL +
  threatCounts.HIGH     * PENALTY.HIGH +
  threatCounts.MEDIUM   * PENALTY.MEDIUM;
const finalScore = Math.max(0, rawLlmScore - threatPenalty);
```

- Penalty coefficients are **constants in code**, not configurable via prompts.
- Only applied when a `threatModelId` is provided.
- **Why deterministic:** a structurally-clean architecture with 6 CRITICAL + 12 HIGH unmitigated
  threats would otherwise score ~92 — meaningless. The formula yields `92 − (6×4) − (12×2) = 44`,
  correctly reflecting real risk. Transparent and auditable; mitigating threats raises the score —
  the feedback loop that makes the re-run experience meaningful.
- `PostureScoreJobResult` returns `score` (final), `rawLlmScore` (structural), `threatPenalty`
  (deducted) so the UI can explain the breakdown.

**Do not** remove/optionalize the penalty, replace it with a prompt instruction, or change
coefficients without updating this skill and the frontend breakdown message.

`useExtended` (extended thinking) is an optional mode that trades latency for deeper analysis.

---

## Attack Simulation

`ATTACK_MIND_SYSTEM_PROMPT` is an APT-style red-team engine. It simulates multi-hop attack paths
from entry points to crown jewels, thinking like a patient APT (e.g. APT29/APT10) exploiting trust
relationships, weak IAM (D5), missing network controls (D4), and architectural flaws (D3) — not
isolated CVEs.

Methodology: reconnaissance (D6) → initial access (D5/D4) → lateral movement (D4/D3) → crown-jewel
identification (D2) → kill-chain construction with **MITRE ATT&CK technique IDs** and the CISSP-domain
failure enabling each step.

Path severity: CRITICAL = reaches crown jewels ≤4 steps OR crosses an unprotected boundary OR exploits
missing auth; HIGH = reaches internal/sensitive data in 4–6 steps OR a D4 segmentation gap; MEDIUM =
reaches internal network but crown jewels are well-protected.

Key rules: edges without TLS labels are assumed unencrypted; missing trust boundaries = no controls
assumed between zones (flat networks score highest likelihood); every path must be architecturally
grounded (only reference nodes/edges that exist). Output: exactly 3 paths sorted by severity, each
with steps, `entryPointNodeId`, `crownJewelNodeIds`, and mitigations. Saved as `AttackSimulation`
(`entryPointNodeId`, `content`); rendered by `AttackPathOverlay` on the canvas. The entry point may be
user-chosen or auto-selected.

---

## Threat Intel Synthesis

`/api/ai/intel-synthesis` (`INTEL_SYNTHESIS_SYSTEM_PROMPT`) synthesizes the project's posture score +
threat set into intelligence narrative and recommendations; `/api/projects/:id/intel-report` produces
a report. Surfaced by `SecurityIntelPage`. This is the "so what / what next" layer on top of the raw
threat + posture data.

---

## Cross-links
- **`prompt-engineer`** — exact prompt wording, output schemas, and the JSON-extraction protocol.
- **`ai-jobs-engineer`** — how these analyses run as async BullMQ jobs (the posture penalty is applied in its processor).
- **`product-manager`** — how these capabilities map to positioning, ICPs, and compliance.
