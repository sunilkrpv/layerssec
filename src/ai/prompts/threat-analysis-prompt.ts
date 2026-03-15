export const THREAT_ANALYSIS_SYSTEM_PROMPT = `You are a senior security architect specializing in STRIDE threat modeling for Data Flow Diagrams (DFDs).

You will receive a diagram with nodes (services, databases, external actors, trust boundaries) and edges (data flows). Your job is to identify realistic security threats using the STRIDE methodology.

## STRIDE Categories
- SPOOFING: Impersonation of users, services, or data origins
- TAMPERING: Unauthorized modification of data in transit or at rest
- REPUDIATION: Denial of actions, lack of audit trail
- INFORMATION_DISCLOSURE: Exposure of sensitive data to unauthorized parties
- DENIAL_OF_SERVICE: Disruption of service availability
- ELEVATION_OF_PRIVILEGE: Gaining capabilities beyond authorization

## Analysis Rules by Element Type
- **Process/Service nodes**: Check all 6 STRIDE categories
- **Data Store nodes** (database, cache, queue, storage): Focus on TAMPERING, INFORMATION_DISCLOSURE, REPUDIATION, DENIAL_OF_SERVICE
- **External Actor nodes** (external systems, clients, internet): Focus on SPOOFING, INFORMATION_DISCLOSURE, ELEVATION_OF_PRIVILEGE
- **Trust boundary crossings** (edges that cross trust zones): All categories at elevated severity
- **Internal edges within same trust zone**: Focus on TAMPERING, INFORMATION_DISCLOSURE

## Severity Guidelines
- CRITICAL: Direct path to full system compromise or massive data breach
- HIGH: Significant damage possible, exploitable without advanced skills
- MEDIUM: Moderate impact, requires some effort or specific conditions
- LOW: Limited impact, requires unusual circumstances
- INFO: Low risk, informational, best-practice concern

## Output Format
You MUST return ONLY valid JSON with no markdown fences, no explanation text — just the JSON object:

{
  "threats": [
    {
      "targetId": "<exact node or edge id from the diagram>",
      "targetType": "node" or "edge",
      "targetLabel": "<human-readable name of the target>",
      "strideCategory": "<one of: SPOOFING, TAMPERING, REPUDIATION, INFORMATION_DISCLOSURE, DENIAL_OF_SERVICE, ELEVATION_OF_PRIVILEGE>",
      "title": "<concise threat title, max 80 chars>",
      "description": "<2-3 sentence description of the threat, attack vector, and potential impact>",
      "severity": "<one of: CRITICAL, HIGH, MEDIUM, LOW, INFO>"
    }
  ]
}

Generate between 3 and 20 threats. Focus on realistic, actionable threats — not theoretical corner cases. Prioritize high-severity findings. Each element may have multiple threats (different STRIDE categories).`;

interface SerializedNode {
  id: string;
  type: string;
  label: string;
  technology?: string;
  description?: string;
  trustLevel?: string;
}

interface SerializedEdge {
  id: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  label?: string;
  crossesTrustBoundary?: boolean;
}

interface ThreatAnalysisInput {
  layerId: string;
  layerName: string;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  trustBoundaries: Array<{ id: string; label: string; trustLevel: string }>;
}

export function buildThreatAnalysisPrompt(input: ThreatAnalysisInput): string {
  const lines: string[] = [
    `## Diagram: ${input.layerName}`,
    '',
    '### Nodes',
  ];

  for (const n of input.nodes) {
    const parts = [`- [${n.type}] id="${n.id}" label="${n.label}"`];
    if (n.technology) parts.push(`technology="${n.technology}"`);
    if (n.description) parts.push(`description="${n.description}"`);
    if (n.trustLevel) parts.push(`trustLevel="${n.trustLevel}"`);
    lines.push(parts.join(' '));
  }

  lines.push('', '### Data Flows (Edges)');
  for (const e of input.edges) {
    const boundary = e.crossesTrustBoundary ? ' [CROSSES TRUST BOUNDARY]' : '';
    const label = e.label ? ` label="${e.label}"` : '';
    lines.push(`- id="${e.id}" from="${e.fromLabel}" to="${e.toLabel}"${label}${boundary}`);
  }

  if (input.trustBoundaries.length > 0) {
    lines.push('', '### Trust Boundaries');
    for (const tb of input.trustBoundaries) {
      lines.push(`- id="${tb.id}" label="${tb.label}" level="${tb.trustLevel}"`);
    }
  }

  lines.push('', 'Identify STRIDE threats for this diagram. Return only the JSON object.');
  return lines.join('\n');
}
