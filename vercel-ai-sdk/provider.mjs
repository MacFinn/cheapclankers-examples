import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export function createCheapClankers({
  apiKey = process.env.CLANKER_API_KEY,
  baseURL = 'https://api.cheapclankers.com/v1',
} = {}) {
  if (!apiKey) throw new Error('Set CLANKER_API_KEY or pass an apiKey.');
  const apiBase = baseURL.replace(/\/+$/, '');
  const provider = createOpenAICompatible({ name: 'cheapclankers', baseURL: apiBase, apiKey });

  return {
    chatModel: (modelId) => provider.chatModel(modelId),
    async listModels({ signal = AbortSignal.timeout(15000) } = {}) {
      const response = await fetch(`${apiBase}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
      });
      if (!response.ok) throw new Error(`Model discovery returned HTTP ${response.status}.`);
      const { data } = await response.json();
      return data;
    },
  };
}
