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
