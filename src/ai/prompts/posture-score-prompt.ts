export const POSTURE_SCORE_SYSTEM_PROMPT = `You are a senior security architect and CISSP expert performing a design-time security posture assessment of a layered software architecture diagram in Drafter, an Engineering + Security platform.

You will receive a multi-layer architecture — a root layer plus any number of named sub-layers. Each layer has its own nodes, trust boundaries, and data flows.

**Score every layer independently**, then produce a weighted aggregate across the whole diagram.

Apply shift-left thinking: this is a design-time assessment. Every gap you identify is an opportunity to fix a security flaw before code is written.

## Scoring Dimensions (20 points each = 100 total)
Each dimension maps to one or more CISSP domains — reference these in your deduction findings.

1. **Attack Surface** (0–20) — CISSP D1 (Risk Mgmt) + D3 (Architecture) + D6 (Assessment)
   - Deductions: internet-facing services without WAF/gateway, unprotected external endpoints, missing TLS on any external edge, too many publicly reachable nodes, no CDN/WAF in front of public traffic.
   - Additions: API gateway as single internet ingress, WAF/CDN present, defence-in-depth layering visible, minimal public exposure.

2. **Identity Posture** (0–20) — CISSP D5 (IAM)
   - Deductions: missing authentication on trust boundary crossings, direct internal access from external actors without auth proxy, no OAuth/OIDC/API key node visible, service-to-service calls without mTLS or signed tokens.
   - Additions: explicit auth/authz nodes (Auth0, Cognito, Okta, OAuth2 server), mTLS between internal services, service mesh with policy enforcement, RBAC signals in descriptions.

3. **Data Protection** (0–20) — CISSP D2 (Asset Security) + D3 (Cryptography)
   - Deductions: data stores with no encryption-at-rest annotation, PII flowing over edges without TLS label, secrets visible in node labels or descriptions, external data flows without explicit encryption, no secrets manager node.
   - Additions: KMS/HSM/Vault nodes present, data stores annotated with encryption status, DLP controls visible, secrets externally managed.

4. **Network Segmentation** (0–20) — CISSP D4 (Network Security)
   - Deductions: no trust boundary nodes in the diagram, flat network (all nodes at same trust level), direct DB access from internet-facing services, internet-accessible services not behind a gateway, missing DMZ zone.
   - Additions: multiple trust boundary zones correctly placed (Internet → DMZ → Internal → Data), explicit DMZ node, private subnet separation visible, all cross-boundary edges labelled with protocol.

5. **Resilience & Monitoring** (0–20) — CISSP D7 (SecOps) + D1 (Availability)
   - Deductions: single points of failure with no redundancy, no logging/monitoring/SIEM nodes for architectures with ≥5 services, no rate limiting at ingress, no circuit breaker pattern visible, no alerting node.
   - Additions: load balancer/multi-AZ visible, centralised logging node (CloudWatch, Datadog, ELK, Grafana), circuit breakers in descriptions, CDN for availability, WAF with rate limiting.

## Severity of Deductions
- CRITICAL gap: −8 to −12 points from that dimension
- HIGH gap: −5 to −7 points
- MEDIUM gap: −2 to −4 points
- POSITIVE control: +2 to +5 points (capped at dimension max)

## Aggregate Score Weighting
Weight each layer by its security importance:
- Root / gateway / ingress layers: weight 1.5x
- Auth / identity layers: weight 1.5x
- Data / database layers: weight 1.3x
- All other layers: weight 1.0x

## Output Format
Return ONLY valid JSON, no markdown, no explanation:

{
  "layerScores": {
    "<layerId>": {
      "layerName": "<human-readable layer name>",
      "score": <integer 0-100>,
      "dimensions": {
        "attackSurface": <integer 0-20>,
        "identityPosture": <integer 0-20>,
        "dataProtection": <integer 0-20>,
        "networkSegmentation": <integer 0-20>,
        "resilienceAndMonitoring": <integer 0-20>
      },
      "deductions": [
        {
          "finding": "<concise description of the gap>",
          "impact": <negative integer e.g. -8>,
          "dimension": "<attackSurface | identityPosture | dataProtection | networkSegmentation | resilienceAndMonitoring>",
          "nodeIds": ["<affected node id(s)>"],
          "severity": "<CRITICAL | HIGH | MEDIUM>"
        }
      ],
      "additions": [
        {
          "finding": "<concise description of the positive control>",
          "impact": <positive integer e.g. 5>,
          "dimension": "<dimension>",
          "nodeIds": ["<relevant node id(s)>"]
        }
      ]
    }
  },
  "aggregate": {
    "score": <weighted average integer 0-100>,
    "dimensions": {
      "attackSurface": <integer 0-20>,
      "identityPosture": <integer 0-20>,
      "dataProtection": <integer 0-20>,
      "networkSegmentation": <integer 0-20>,
      "resilienceAndMonitoring": <integer 0-20>
    },
    "deductions": [ <top cross-cutting deductions from all layers combined> ],
    "additions": [ <top cross-cutting strengths from all layers combined> ],
    "summary": "<2-3 sentence overall posture summary across all layers>",
    "topRecs": [
      "<highest priority recommendation>",
      "<second recommendation>",
      "<third recommendation>"
    ]
  }
}

Be accurate, specific, and reference actual node labels and IDs. Do not invent nodes that don't exist.`;

const DIMENSION_LABELS: Record<string, string> = {
  attackSurface: 'Attack Surface',
  identityPosture: 'Identity Posture',
  dataProtection: 'Data Protection',
  networkSegmentation: 'Network Segmentation',
  resilienceAndMonitoring: 'Resilience & Monitoring',
};

export interface NormalizedLayerScore {
  layerId: string;
  layerName: string;
  score: number;
  dimensions: { name: string; score: number; maxScore: number }[];
  deductions: { reason: string; points: number; severity?: string; dimension?: string }[];
  additions: { reason: string; points: number; dimension?: string }[];
}

export interface NormalizedPostureResult {
  layerScores: Record<string, NormalizedLayerScore>;
  aggregate: {
    score: number;
    dimensions: { name: string; score: number; maxScore: number }[];
    deductions: { reason: string; points: number; severity?: string; dimension?: string }[];
    additions: { reason: string; points: number; dimension?: string }[];
    summary: string;
    topRecs: string[];
  };
}

type RawDimensions = Record<string, number>;
type RawDeduction = { finding?: string; reason?: string; impact?: number; points?: number; severity?: string; dimension?: string; nodeIds?: string[] };
type RawAddition = { finding?: string; reason?: string; impact?: number; points?: number; dimension?: string; nodeIds?: string[] };

function normalizeDimensions(raw: RawDimensions): { name: string; score: number; maxScore: number }[] {
  return Object.entries(raw ?? {}).map(([key, score]) => ({
    name: DIMENSION_LABELS[key] ?? key,
    score: typeof score === 'number' ? score : 0,
    maxScore: 20,
  }));
}

function normalizeDeductions(raw: RawDeduction[]): { reason: string; points: number; severity?: string; dimension?: string }[] {
  return (raw ?? []).map((d) => ({
    reason: d.finding ?? d.reason ?? '',
    points: Math.abs(d.impact ?? d.points ?? 0),
    severity: d.severity,
    dimension: d.dimension,
  }));
}

function normalizeAdditions(raw: RawAddition[]): { reason: string; points: number; dimension?: string }[] {
  return (raw ?? []).map((a) => ({
    reason: a.finding ?? a.reason ?? '',
    points: Math.abs(a.impact ?? a.points ?? 0),
    dimension: a.dimension,
  }));
}

export function normalizePostureResult(raw: Record<string, unknown>): NormalizedPostureResult {
  const rawLayerScores = (raw['layerScores'] ?? {}) as Record<string, {
    layerName?: string;
    score?: number;
    dimensions?: RawDimensions;
    deductions?: RawDeduction[];
    additions?: RawAddition[];
  }>;

  const layerScores: Record<string, NormalizedLayerScore> = {};
  for (const [layerId, ls] of Object.entries(rawLayerScores)) {
    layerScores[layerId] = {
      layerId,
      layerName: ls.layerName ?? layerId,
      score: ls.score ?? 0,
      dimensions: normalizeDimensions(ls.dimensions ?? {}),
      deductions: normalizeDeductions(ls.deductions ?? []),
      additions: normalizeAdditions(ls.additions ?? []),
    };
  }

  const agg = (raw['aggregate'] ?? {}) as {
    score?: number;
    dimensions?: RawDimensions;
    deductions?: RawDeduction[];
    additions?: RawAddition[];
    summary?: string;
    topRecs?: string[];
  };

  // Fallback: if AI didn't return aggregate, compute simple average from layerScores
  const layerScoreValues = Object.values(layerScores).map((l) => l.score);
  const fallbackScore = layerScoreValues.length > 0
    ? Math.round(layerScoreValues.reduce((a, b) => a + b, 0) / layerScoreValues.length)
    : 0;

  return {
    layerScores,
    aggregate: {
      score: agg.score ?? fallbackScore,
      dimensions: normalizeDimensions(agg.dimensions ?? {}),
      deductions: normalizeDeductions(agg.deductions ?? []),
      additions: normalizeAdditions(agg.additions ?? []),
      summary: agg.summary ?? '',
      topRecs: agg.topRecs ?? [],
    },
  };
}

interface PostureScoreInput {
  layers: Record<string, {
    id: string;
    name: string;
    nodes: Array<{ id: string; type?: string; data?: { label?: string; technology?: string; description?: string; trustLevel?: string } }>;
    edges: Array<{ id: string; source: string; target: string; label?: string }>;
  }>;
}

export function buildPostureScorePrompt(input: PostureScoreInput): string {
  const lines: string[] = ['# Layered Architecture Diagram for Security Posture Assessment', ''];

  for (const layer of Object.values(input.layers)) {
    if (!layer || !layer.nodes?.length) continue;

    lines.push(`## Layer id="${layer.id}" name="${layer.name || layer.id}"`);
    lines.push('');
    lines.push('### Nodes');

    const trustBoundaries: typeof layer.nodes = [];
    const regularNodes: typeof layer.nodes = [];
    for (const n of layer.nodes) {
      if (n.type === 'trustboundary') trustBoundaries.push(n);
      else regularNodes.push(n);
    }

    for (const n of regularNodes) {
      const label = n.data?.label ?? n.id;
      const parts = [`- [${n.type ?? 'unknown'}] id="${n.id}" label="${label}"`];
      if (n.data?.technology) parts.push(`technology="${n.data.technology}"`);
      if (n.data?.description) parts.push(`description="${n.data.description}"`);
      if (n.data?.trustLevel) parts.push(`trustLevel="${n.data.trustLevel}"`);
      lines.push(parts.join(' '));
    }

    if (trustBoundaries.length > 0) {
      lines.push('');
      lines.push('### Trust Boundaries');
      for (const tb of trustBoundaries) {
        const label = tb.data?.label ?? tb.id;
        const trustLevel = tb.data?.trustLevel ?? 'unknown';
        lines.push(`- id="${tb.id}" label="${label}" trustLevel="${trustLevel}"`);
      }
    }

    if (layer.edges?.length > 0) {
      lines.push('');
      lines.push('### Data Flows');
      const nodeMap = new Map(layer.nodes.map((n) => [n.id, n.data?.label ?? n.id]));
      for (const e of layer.edges) {
        const fromLabel = nodeMap.get(e.source) ?? e.source;
        const toLabel = nodeMap.get(e.target) ?? e.target;
        const edgeLabel = e.label ? ` label="${e.label}"` : '';
        lines.push(`- id="${e.id}" from="${fromLabel}" (id="${e.source}") → to="${toLabel}" (id="${e.target}")${edgeLabel}`);
      }
    }

    lines.push('');
  }

  lines.push(`Score each of the ${Object.values(input.layers).filter(l => l?.nodes?.length).length} layer(s) listed above independently, then compute a weighted aggregate. Return only the JSON object.`);
  return lines.join('\n');
}
