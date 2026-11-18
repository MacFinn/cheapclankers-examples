import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

export async function chat({ baseURL, apiKey, model }) {
  if (!apiKey || !model) throw new Error('Set CLANKER_API_KEY and CLANKER_MODEL.');
  const models = await fetch(`${baseURL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!models.ok) throw new Error(`Model discovery returned HTTP ${models.status}.`);
  const { data } = await models.json();
  if (!data.some(({ id }) => id === model)) {
    throw new Error('Selected model is unavailable to this key.');
  }
  const provider = createOpenAICompatible({ name: 'cheapclankers', baseURL, apiKey });
  const { text } = await generateText({
    model: provider.chatModel(model),
    prompt: 'Reply with one short greeting.',
    maxOutputTokens: 64,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(30000),
  });
  return text;
}
