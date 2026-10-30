import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { setTimeout as delay } from 'node:timers/promises';
import { createLocalAiGateway } from '../src/local-ai/server.js';
import { createOllamaProvider, OLLAMA_MODEL } from '../src/services/ollama.js';
import { createAiCapacity } from '../src/services/aiCapacity.js';

const tokenA = 'synthetic-adrift-token-not-real-1234567890', tokenB = 'synthetic-navi-token-not-real-123456789012';
const clients = [{ project: 'adrift', token: tokenA }, { project: 'navi', token: tokenB }];
const logs = [], logger = { info: (...args) => logs.push(args), warn: (...args) => logs.push(args) };
const input = { messages: [{ role: 'user', content: 'synthetic private diary' }], format: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] } };
let upstreamServer, gatewayServer, url, upstreamPort, capacity, a, b, mode = 'ok', release, inferenceCalls = 0;
const start = app => new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
const stop = server => new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
const until = async predicate => { for (let index = 0; index < 200; index++) { if (predicate()) return; await delay(5); } throw new Error('Fixture condition did not settle'); };
function upstream() {
  const app = express(); app.use(express.json());
  app.get('/api/version', (_req, res) => res.json({ version: 'mock-ollama' }));
  app.post('/api/show', (_req, res) => mode === 'missing' ? res.status(404).json({ error: 'not found' }) : res.json({ capabilities: ['completion', 'tools'] }));
  app.get('/api/ps', (_req, res) => res.json({ models: [] }));
  for (const kind of ['chat', 'generate']) app.post(`/api/${kind}`, async (req, res) => {
    inferenceCalls++;
    if (mode === 'wait') await new Promise(resolve => { release = resolve; });
    if (mode === 'fail') return res.status(503).json({ error: 'internal private upstream error' });
    const text = '{"answer":"合成回答"}';
    res.json({ model: OLLAMA_MODEL, done: mode !== 'invalid', done_reason: 'stop', prompt_eval_count: 20, eval_count: 5,
      ...(kind === 'chat' ? { message: { role: 'assistant', content: text } } : { response: text }) });
  });
  return app;
}
before(async () => {
  upstreamServer = await start(upstream()); upstreamPort = upstreamServer.address().port;
  const provider = createOllamaProvider({ target: 'ollama', baseUrl: `http://127.0.0.1:${upstreamPort}`, logger });
  const gateway = createLocalAiGateway({ clients, provider, logger }); capacity = gateway.capacity;
  gatewayServer = await start(gateway.app); url = `http://127.0.0.1:${gatewayServer.address().port}`;
  a = createOllamaProvider({ baseUrl: url, token: tokenA, logger }); b = createOllamaProvider({ baseUrl: url, token: tokenB, logger });
});
after(async () => { capacity.close(); release?.(); await stop(gatewayServer); await stop(upstreamServer); });

test('gateway rejects missing credentials and browser origins before contacting Ollama', async () => {
  const count = inferenceCalls;
  assert.equal((await fetch(url + '/health')).status, 401);
  assert.equal((await fetch(url + '/health', { headers: { Authorization: `Bearer ${tokenA}`, Origin: 'https://adrifttw.com' } })).status, 403);
  assert.equal(inferenceCalls, count);
});
test('gateway cannot proxy arbitrary Ollama management paths or accept host, model and sampler overrides', async () => {
  const count = inferenceCalls;
  for (const path of ['/api/pull', '/api/delete', '/api/chat', '/v1/not-allowed']) {
    const result = await fetch(url + path, { method: 'POST', headers: { Authorization: `Bearer ${tokenA}` } });
    assert.ok([400, 404].includes(result.status));
  }
  for (const body of [{ ...input, url: 'http://evil.test' }, { ...input, model: 'unapproved-model' }, { ...input, options: { num_ctx: 262144 } }]) {
    const result = await fetch(url + '/v1/chat', { method: 'POST', headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json',
      'X-Request-ID': 'invalid-options', 'X-AI-Subject': 'a'.repeat(64), 'X-AI-Feature': 'smoke' }, body: JSON.stringify(body) });
    assert.equal(result.status, 400);
  }
  assert.equal(inferenceCalls, count);
});
test('real loopback HTTP adapter-gateway-provider integration validates structured output and cold health', async () => {
  const health = await a.healthCheck(); assert.equal(health.upstream.available, true); assert.equal(health.upstream.loaded, false);
  assert.equal(health.capacity.concurrency, 1);
  assert.equal((await a.chat(input)).json.answer, '合成回答');
  assert.equal((await a.generate({ prompt: '合成測試', format: input.format })).json.answer, '合成回答');
});
test('separate projects share actual HTTP queue capacity; excess work is rejected before inference', async () => {
  mode = 'wait'; release = undefined; const count = inferenceCalls;
  const one = a.chat({ ...input, subject: 'one' }); await until(() => release);
  const two = a.chat({ ...input, subject: 'two' }); const three = b.chat({ ...input, subject: 'three' });
  await until(() => capacity.state().queued === 2);
  await assert.rejects(a.chat({ ...input, subject: 'extra' }), error => error.category === 'queue_full');
  assert.equal(inferenceCalls, count + 1); mode = 'ok'; release();
  assert.deepEqual((await Promise.all([one, two, three])).map(item => item.json.answer), ['合成回答', '合成回答', '合成回答']);
});
test('HTTP abort of a queued job removes it without cancelling the other project', async () => {
  mode = 'wait'; release = undefined;
  const first = a.chat({ ...input, subject: 'active' }); await until(() => release);
  const controller = new AbortController();
  const waiting = b.chat({ ...input, subject: 'waiting', signal: controller.signal }); await until(() => capacity.state().queued === 1);
  controller.abort(); await assert.rejects(waiting, error => error.name === 'AbortError');
  await until(() => capacity.state().queued === 0); assert.equal(capacity.state().active, 1);
  mode = 'ok'; release(); await first;
});
test('HTTP abort of active work returns immediately but drains before the next project runs', async () => {
  mode = 'wait'; release = undefined; const count = inferenceCalls;
  const controller = new AbortController();
  const first = a.chat({ ...input, subject: 'active-cancel', signal: controller.signal }); await until(() => release);
  controller.abort(); await assert.rejects(first, error => error.name === 'AbortError');
  await until(() => capacity.state().draining);
  const next = b.chat({ ...input, subject: 'after-drain' }); await until(() => capacity.state().queued === 1);
  assert.equal(inferenceCalls, count + 1); mode = 'ok'; release(); await next; assert.equal(inferenceCalls, count + 2);
});
test('invalid responses and Ollama 503 remain feature failures; health still works and secrets are not returned', async () => {
  const count = inferenceCalls;
  mode = 'invalid'; await assert.rejects(a.chat(input), error => error.category === 'invalid_response');
  mode = 'fail'; await assert.rejects(a.chat(input), error => error.category === 'provider_unavailable');
  assert.equal(inferenceCalls, count + 2, 'generation failures never retry automatically');
  mode = 'ok'; assert.equal((await a.healthCheck()).upstream.available, true);
  assert.doesNotMatch(JSON.stringify(logs), /synthetic private diary|synthetic-adrift-token|synthetic-navi-token|internal private upstream/);
  await a.chat(input);
});
test('local mock service stop/restart is detected and health recovers without pulling or generating a model', async () => {
  await stop(upstreamServer);
  await assert.rejects(a.healthCheck(), error => error.category === 'ollama_offline');
  await assert.rejects(a.chat(input), error => error.category === 'ollama_offline');
  assert.equal(capacity.state().recoveryRequired, false, 'connection refusal before dispatch does not imply orphan GPU work');
  upstreamServer = await new Promise(resolve => { const server = upstream().listen(upstreamPort, '127.0.0.1', () => resolve(server)); });
  const count = inferenceCalls;
  assert.equal((await a.healthCheck()).upstream.available, true); assert.equal(inferenceCalls, count);
  assert.equal((await a.chat(input)).json.answer, '合成回答');
});
test('gateway configuration rejects weak credentials and duplicate project tokens', () => {
  for (const clients of [[], [{ project: 'adrift', token: 'short' }], [{ project: 'adrift', token: tokenA }, { project: 'navi', token: tokenA }]]) {
    assert.throws(() => createLocalAiGateway({ clients }), /configuration/);
  }
});
