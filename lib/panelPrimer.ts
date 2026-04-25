export interface PrimerMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** A primer is a user message auto-injected by the backend that sets context
 * for the assistant — it is not a real user turn and should not render as a bubble.
 *
 * Heuristic: the FIRST message must be role=user AND start with one of the
 * known primer prefixes. Anything else is treated as real chat.
 */
const PRIMER_PREFIXES = [
  'You are looking at',
  'Current layer context:',
  'Diagram context:',
];

export interface PrimerSplit<T extends PrimerMessage> {
  primer: T | null;
  rest: T[];
}

export function splitPrimer<T extends PrimerMessage>(messages: T[]): PrimerSplit<T> {
  if (messages.length === 0) return { primer: null, rest: messages };
  const first = messages[0];
  if (first.role !== 'user') return { primer: null, rest: messages };
  const isPrimer = PRIMER_PREFIXES.some((p) => first.content.trimStart().startsWith(p));
  if (!isPrimer) return { primer: null, rest: messages };
  return { primer: first, rest: messages.slice(1) };
}

/** Short human label for the chip — first 80 chars or up to first newline. */
export function primerLabel(primer: PrimerMessage): string {
  const line = primer.content.split('\n')[0].trim();
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}
