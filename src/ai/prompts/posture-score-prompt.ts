export const POSTURE_SCORE_SYSTEM_PROMPT = `You are a senior security architect performing a design-time security posture assessment of a layered software architecture diagram.

You will receive a multi-layer architecture — a root layer plus any number of named sub-layers (drill-downs into individual services or subsystems). Each layer has its own nodes and data flows.

**Score every layer independently**, then produce a weighted aggregate across the whole diagram.

## Scoring Dimensions (20 points each = 100 total)

1. **Attack Surface** (0–20): Exposure to external threats.
   - Deductions: internet-facing services without WAF/gateway, unprotected external endpoints, missing TLS on external flows, too many publicly reachable nodes.
   - Additions: WAF present, API gateway as single ingress, defense-in-depth layering.

2. **Identity Posture** (0–20): Authentication and authorization strength.
   - Deductions: missing auth on trust boundary crossings, direct internal access from external actors without auth proxy, no IAM/RBAC signals.
   - Additions: explicit auth/authz nodes (Auth0, Cognito, OAuth), mTLS on internal services, service mesh present.

3. **Data Protection** (0–20): How well sensitive data is protected.
   - Deductions: data stores with no encryption annotations, PII flows across unprotected edges, secrets visible in labels, external flows without TLS.
   - Additions: KMS/HSM nodes, encrypted data stores annotated, DLP visible.

4. **Network Segmentation** (0–20): Quality of network isolation.
   - Deductions: missing trust boundaries between logical zones, flat network, direct DB access from internet-facing services.
   - Additions: multiple trust boundary zones, DMZ present, internal/external segregation explicit.

5. **Resilience & Monitoring** (0–20): Operational security and observability.
   - Deductions: single points of failure, no logging/SIEM nodes, no redundancy, no rate limiting.
   - Additions: load balancer, logging/monitoring nodes, circuit breakers, CDN.

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
