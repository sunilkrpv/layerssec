export function buildRefinePrompt(
  userPrompt: string,
  canvasData: Record<string, any>,
): string {
  return `The user wants to modify their existing diagram. Here is the current canvas state:

${JSON.stringify(canvasData, null, 2)}

User's request: "${userPrompt}"

Return the COMPLETE updated canvas (all elements + connections), incorporating the user's requested changes. Preserve element IDs for unchanged elements.`;
}
