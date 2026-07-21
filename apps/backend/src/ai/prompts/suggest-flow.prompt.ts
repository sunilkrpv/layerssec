import { PromptTemplate } from '@langchain/core/prompts';

export const suggestFlowPrompt = PromptTemplate.fromTemplate(`
You are a security architect. Propose a Data Flow Diagram (DFD) for the flow named "{flowName}" in the application below.

Application context:
- Name: {projectName}
- Description: {projectDescription}
- Tech stack: {techStack}
- Environment: {environment}
- Compliance: {compliance}
- Notes: {notes}

Existing flows in this project: {existingFlows}

Return the diagram between markers as a single JSON object with fields {{ nodes, edges }} following React Flow conventions:

---DIAGRAM---
{{json}}
---DIAGRAM---

Where each node has {{ id, type, position, data: {{ label, kind }} }} and each edge has {{ id, source, target, label }}.
Be specific: include external entities, trust boundaries, processes, and data stores relevant to "{flowName}".
`);
