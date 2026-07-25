import { parseConverse } from './converse-parser';

describe('parseConverse', () => {
  it('parses a refuse turn', () => {
    const r = parseConverse('{"mode":"refuse","message":"I only model software."}');
    expect(r.mode).toBe('refuse');
    if (r.mode === 'refuse') expect(r.message).toContain('software');
  });

  it('parses an ask turn', () => {
    const r = parseConverse('{"mode":"ask","message":"Which flow first?"}');
    expect(r.mode).toBe('ask');
  });

  it('strips markdown fences before parsing', () => {
    const r = parseConverse('```json\n{"mode":"ask","message":"hi"}\n```');
    expect(r.mode).toBe('ask');
  });

  it('parses a generate turn and sanitizes positions', () => {
    const raw = JSON.stringify({
      mode: 'generate',
      message: 'Drew login flow',
      diagramName: 'User Login Flow',
      nodes: [{ id: 'client', type: 'client' }, { id: 'api', type: 'service', position: { x: 5, y: 6 } }],
      edges: [{ id: 'e1', source: 'client', target: 'api', label: 'Creds (HTTPS/TLS)' }],
    });
    const r = parseConverse(raw);
    expect(r.mode).toBe('generate');
    if (r.mode === 'generate') {
      expect(typeof (r.nodes[0] as { position: { x: unknown } }).position.x).toBe('number');
      expect(r.diagramName).toBe('User Login Flow');
    }
  });

  it('strips any technology field from generated nodes', () => {
    const raw = JSON.stringify({
      mode: 'generate',
      message: 'x',
      diagramName: 'Flow',
      nodes: [{ id: 'db', type: 'database', position: { x: 1, y: 1 }, data: { label: 'DB', technology: 'PostgreSQL 15', trustLevel: 'internal' } }],
      edges: [],
    });
    const r = parseConverse(raw);
    if (r.mode === 'generate') {
      const data = (r.nodes[0] as { data: Record<string, unknown> }).data;
      expect(data.technology).toBeUndefined();
      expect(data.label).toBe('DB');
    } else {
      throw new Error('expected generate');
    }
  });

  it('throws on invalid JSON', () => {
    expect(() => parseConverse('not json')).toThrow();
  });

  it('throws when generate mode lacks node/edge arrays', () => {
    expect(() => parseConverse('{"mode":"generate","message":"x"}')).toThrow();
  });
});
