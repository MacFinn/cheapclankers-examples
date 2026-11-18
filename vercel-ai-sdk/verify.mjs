import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { chat } from './chat.mjs';

const seen = [];
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : null;
  seen.push([req.method, req.url, req.headers.authorization, body]);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(req.method === 'GET' ? { data: [{ id: 'fixture' }] } : {
    id: 'fixture-response',
    model: 'fixture',
    choices: [{ index: 0, message: { role: 'assistant', content: 'Fixture greeting' }, finish_reason: 'stop' }],
  }));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const opts = { baseURL: `http://127.0.0.1:${server.address().port}/v1`, apiKey: 'fixture-key' };
  await assert.rejects(chat({ ...opts, model: 'missing' }), /unavailable/);
  assert.deepEqual(seen.splice(0), [['GET', '/v1/models', 'Bearer fixture-key', null]]);
  assert.equal(await chat({ ...opts, model: 'fixture' }), 'Fixture greeting');
  assert.deepEqual(seen.map(entry => entry.slice(0, 3)), [
    ['GET', '/v1/models', 'Bearer fixture-key'],
    ['POST', '/v1/chat/completions', 'Bearer fixture-key'],
  ]);
  const payload = seen[1][3];
  assert.equal(payload.model, 'fixture');
  assert.equal(payload.max_tokens ?? payload.max_completion_tokens, 64);
  console.log('Vercel AI SDK fixture checks passed');
} finally {
  server.close();
}
