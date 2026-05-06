export interface DiagramPayload {
  nodes: unknown[];
  edges: unknown[];
}

export const DIAGRAM_SEP = '---DIAGRAM---';

export function formatChatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Split streamed/stored text into display text + optional diagram JSON.
 *  Handles both the ---DIAGRAM--- separator protocol and fallback markdown code blocks. */
export function splitDiagramContent(raw: string): { text: string; diagram: DiagramPayload | null } {
  const idx = raw.indexOf(DIAGRAM_SEP);
  if (idx !== -1) {
    const text = raw.slice(0, idx).trim();
    const jsonStr = raw.slice(idx + DIAGRAM_SEP.length).trim();
    try {
      const parsed = JSON.parse(jsonStr) as DiagramPayload;
      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        return { text, diagram: parsed };
      }
    } catch { /* ignore */ }
    return { text: raw, diagram: null };
  }

  const codeBlockMatches = Array.from(raw.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi));
  if (codeBlockMatches.length > 0) {
    const lastMatch = codeBlockMatches[codeBlockMatches.length - 1];
    try {
      const parsed = JSON.parse(lastMatch[1].trim()) as DiagramPayload;
      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        const text = raw.slice(0, lastMatch.index).trim();
        return { text, diagram: parsed };
      }
    } catch { /* not a diagram JSON block */ }
  }

  return { text: raw, diagram: null };
}
