export interface ProjectContextHint {
  techStack?: string[];
  environment?: string | null;
  compliance?: string[];
}

export function formatProjectContextBlock(ctx?: ProjectContextHint): string {
  if (!ctx) return '';
  const techStack = (ctx.techStack ?? []).join(', ');
  const env = ctx.environment ?? '';
  const compliance = (ctx.compliance ?? []).join(', ');
  if (!techStack && !env && !compliance) return '';
  return `Project context:\n- Tech stack: ${techStack || '(unspecified)'}\n- Environment: ${env || '(unspecified)'}\n- Compliance: ${compliance || '(none)'}\n\n`;
}
