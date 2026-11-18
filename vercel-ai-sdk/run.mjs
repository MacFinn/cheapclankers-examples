import { chat } from './chat.mjs';

const text = await chat({
  baseURL: (process.env.CLANKER_BASE_URL || 'https://api.cheapclankers.com/v1').replace(/\/+$/, ''),
  apiKey: process.env.CLANKER_API_KEY,
  model: process.env.CLANKER_MODEL,
});
console.log(text || '(no text returned)');
