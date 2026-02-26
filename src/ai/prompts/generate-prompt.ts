export function buildGeneratePrompt(
  userPrompt: string,
  existingCanvas?: Record<string, any>,
): string {
  let prompt = `Generate diagram elements for the following request:\n\n"${userPrompt}"`;

  if (existingCanvas && Object.keys(existingCanvas).length > 0) {
    prompt += `\n\nThe canvas already has these elements (position new elements to avoid overlap):\n${JSON.stringify(existingCanvas, null, 2)}`;
  }

  prompt += '\n\nRespond ONLY with the JSON object. No markdown, no explanation outside the JSON.';
  return prompt;
}
