import { sanitizeNodePositions, validateOversizeWarning, coerceName, extractJsonObject } from '../diagram-postprocess';

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
  const obj = JSON.parse(extractJsonObject(raw)) as { mode?: unknown; message?: unknown } & Record<string, unknown>;
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
