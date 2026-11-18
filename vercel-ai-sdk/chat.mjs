import { generateText } from 'ai';
import { createCheapClankers } from './provider.mjs';

export async function chat({ baseURL, apiKey, model }) {
  if (!apiKey || !model) throw new Error('Set CLANKER_API_KEY and CLANKER_MODEL.');
  const provider = createCheapClankers({ baseURL, apiKey });
  const data = await provider.listModels();
  if (!data.some(({ id }) => id === model)) {
    throw new Error('Selected model is unavailable to this key.');
  }
  const { text } = await generateText({
    model: provider.chatModel(model),
    prompt: 'Reply with one short greeting.',
    maxOutputTokens: 64,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(30000),
  });
  return text;
}
