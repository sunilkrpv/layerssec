import { buildAttackMindPrompt } from './attack-mind-prompt';

describe('buildAttackMindPrompt', () => {
  it('includes project context when provided', () => {
    const out = buildAttackMindPrompt({
      layers: {
        root: {
          id: 'root',
          name: 'Main',
          nodes: [],
          edges: [],
        },
      },
      projectContext: { techStack: ['Node'], environment: 'PROD', compliance: ['SOC2'] },
    });
    expect(out).toContain('Node');
    expect(out).toContain('PROD');
    expect(out).toContain('SOC2');
    expect(out).toContain('Project context:');
  });

  it('omits the project context block when none provided', () => {
    const out = buildAttackMindPrompt({
      layers: {
        root: {
          id: 'root',
          name: 'Main',
          nodes: [],
          edges: [],
        },
      },
    });
    expect(out).not.toContain('Project context:');
  });
});
