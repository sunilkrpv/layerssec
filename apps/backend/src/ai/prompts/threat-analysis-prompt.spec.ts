import { buildThreatAnalysisPrompt } from './threat-analysis-prompt';

describe('buildThreatAnalysisPrompt', () => {
  it('includes project context when provided', () => {
    const out = buildThreatAnalysisPrompt({
      layerId: 'root',
      layerName: 'Main',
      nodes: [],
      edges: [],
      trustBoundaries: [],
      projectContext: { techStack: ['Node'], environment: 'PROD', compliance: ['SOC2'] },
    });
    expect(out).toContain('Node');
    expect(out).toContain('PROD');
    expect(out).toContain('SOC2');
    expect(out).toContain('Project context:');
  });

  it('omits the project context block when none provided', () => {
    const out = buildThreatAnalysisPrompt({
      layerId: 'root',
      layerName: 'Main',
      nodes: [],
      edges: [],
      trustBoundaries: [],
    });
    expect(out).not.toContain('Project context:');
  });
});
