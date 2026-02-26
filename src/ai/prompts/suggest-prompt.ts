export function buildSuggestPrompt(canvasData: Record<string, any>): string {
  return `Analyze this diagram and suggest improvements:

${JSON.stringify(canvasData, null, 2)}

Suggest:
1. Missing elements that would make the diagram more complete
2. Better layout arrangements
3. Missing connections between related elements
4. Label improvements

Respond with the same JSON schema, only including the NEW or MODIFIED elements.`;
}
