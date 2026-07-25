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

/**
 * Pull the first balanced top-level JSON object out of a raw LLM response.
 *
 * Robust to what fence-stripping alone misses: reasoning preambles (`<think>…</think>`),
 * prose ("Here is the JSON:"), markdown fences anywhere, and trailing commentary after
 * the object. Scans brace depth while respecting string literals + escapes, so braces
 * inside string values don't end the object early. Throws if no balanced object exists.
 */
export function extractJsonObject(raw: string): string {
  const withoutThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const start = withoutThink.indexOf('{');
  if (start === -1) throw new Error('no JSON object found in LLM response');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < withoutThink.length; i++) {
    const ch = withoutThink[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return withoutThink.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced JSON object in LLM response');
}
