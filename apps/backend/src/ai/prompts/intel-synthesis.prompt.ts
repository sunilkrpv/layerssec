import { PromptTemplate } from '@langchain/core/prompts';

export const intelSynthesisPrompt = PromptTemplate.fromTemplate(`
You are a senior threat-intelligence analyst. Synthesize an intel report for the application below.

PROJECT:
- Name: {projectName}
- Description: {projectDescription}
- Tech stack: {techStack}
- Environment: {environment}
- Compliance: {compliance}
- Notes: {notes}

FLOWS (one entry per data-flow diagram in this project):
{diagramSummaries}

Output sections (markdown):
1. Threat Landscape — relevant threat actors and campaigns for this stack/sector.
2. Sector Trends — recent (last 12 months) incidents in similar applications.
3. Compliance Gaps — risks against listed compliance frameworks.
4. Top Recommendations — prioritised actions, citing affected flows by name.
`);
