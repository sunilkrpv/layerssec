import { sanitizeNodePositions, validateOversizeWarning, coerceName } from './diagram-postprocess';

describe('diagram-postprocess', () => {
  describe('sanitizeNodePositions', () => {
    it('keeps valid numeric positions untouched', () => {
      const nodes = [{ id: 'a', position: { x: 10, y: 20 } }];
      expect(sanitizeNodePositions(nodes)[0].position).toEqual({ x: 10, y: 20 });
    });

    it('defaults missing positions to a grid and reports the id', () => {
      const seen: string[] = [];
      const out = sanitizeNodePositions([{ id: 'a' }, { id: 'b', position: {} }], (id) => seen.push(id));
      expect(typeof (out[0].position as { x: unknown }).x).toBe('number');
      expect(typeof (out[1].position as { y: unknown }).y).toBe('number');
      expect(seen).toEqual(['a', 'b']);
    });
  });

  describe('validateOversizeWarning', () => {
    it('accepts a well-formed warning', () => {
      const w = { reason: 'big', suggestedSplits: ['A', 'B'] };
      expect(validateOversizeWarning(w)).toEqual(w);
    });

    it('rejects malformed warnings', () => {
      expect(validateOversizeWarning(null)).toBeUndefined();
      expect(validateOversizeWarning({ reason: 'x', suggestedSplits: [1] })).toBeUndefined();
      expect(validateOversizeWarning({ reason: 5, suggestedSplits: [] })).toBeUndefined();
    });
  });

  describe('coerceName', () => {
    it('trims and truncates non-empty strings', () => {
      expect(coerceName('  Orders Platform  ', 60)).toBe('Orders Platform');
      expect(coerceName('x'.repeat(100), 10)).toHaveLength(10);
    });

    it('returns undefined for empty/non-string', () => {
      expect(coerceName('   ', 60)).toBeUndefined();
      expect(coerceName(42, 60)).toBeUndefined();
    });
  });
});
