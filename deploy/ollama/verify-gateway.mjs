import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import { createOllamaProvider } from '../../apps/api/src/services/ollama.js';
import { createAiProvider } from '../../apps/api/src/services/aiProvider.js';

// Run in a private acceptance directory, never the production application process.
const clients = JSON.parse(readFileSync(process.env.GATEWAY_CLIENTS_FILE || '/etc/adrift-ai/clients.json', 'utf8'));
const token = clients.find(item => item.project === 'adrift')?.token;
assert.ok(token, 'Acceptance credential missing');
const baseUrl = 'http://127.0.0.1:11435';
const quiet = { info() {}, warn() {} };
const a = createOllamaProvider({ baseUrl, token, allow8k: true, logger: quiet });
if (process.argv.includes('--health-only')) {
  const expected = process.env.EXPECT_GATEWAY_ERROR;
  try {
    const status = await a.healthCheck();
    assert.equal(expected, undefined, 'Expected an unavailable transport/provider');
    assert.equal(status.upstream.available, true);
    console.log(JSON.stringify({ passed: true, status: status.status, loaded: status.upstream.loaded, capacity: status.capacity }));
  } catch (error) {
    if (!expected || error.category !== expected) throw error;
    console.log(JSON.stringify({ passed: true, expectedFailure: expected }));
  }
  process.exit(0);
}
const schema = { type: 'object', properties: { message: { type: 'string' } }, required: ['message'], additionalProperties: false };
const question = { messages: [{ role: 'user', content: '輸出 JSON，message 是「測試完成」。' }], format: schema,
  maxOutputTokens: 128, requestId: randomUUID(), feature: 'smoke' };
const cases = [];
const check = async (name, fn) => { const started = Date.now(); await fn(); cases.push(name); console.log(JSON.stringify({ test: name, passed: true, wallMs: Date.now() - started })); };
const until = async predicate => { for (let index = 0; index < 80; index++) { const status = await a.healthCheck(); if (predicate(status)) return status; await delay(100); } throw new Error('Acceptance condition did not settle'); };

await check('private-health-and-auth', async () => {
  assert.equal((await fetch(baseUrl + '/health')).status, 401);
  const status = await a.healthCheck(); assert.equal(status.upstream.available, true); assert.equal(status.capacity.concurrency, 1);
});
await check('vps-adapter-structured-json-4k', async () => {
  const value = await a.chat(question); assert.equal(value.json.message, '測試完成');
  const status = await a.healthCheck(); assert.equal(status.upstream.contextLength, 4096);
  console.log(JSON.stringify({ model: value.model, metrics: value.metrics, context: status.upstream.contextLength, modelVramBytes: status.upstream.vramBytes }));
});
await check('vps-adapter-generate-8k', async () => {
  const value = await a.generate({ prompt: '輸出 JSON，message 是「測試完成」。', format: schema, contextLength: 8192, maxOutputTokens: 128, feature: 'smoke' });
  assert.equal(value.json.message, '測試完成'); const status = await a.healthCheck(); assert.equal(status.upstream.contextLength, 8192);
  console.log(JSON.stringify({ model: value.model, metrics: value.metrics, context: status.upstream.contextLength, modelVramBytes: status.upstream.vramBytes }));
});
await check('vps-tool-calling-without-execution', async () => {
  const value = await a.chat({ messages: [{ role: 'user', content: '呼叫 lookup_memory，query 設為「河邊散步」。不要自行回答。' }],
    tools: [{ type: 'function', function: { name: 'lookup_memory', description: '只做合成驗收，不執行工具。', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false } } }], maxOutputTokens: 128, feature: 'smoke' });
  assert.equal(value.toolCalls[0]?.function.name, 'lookup_memory'); assert.equal(value.toolCalls[0]?.function.arguments.query, '河邊散步');
});
await check('isolated-express-selector-to-real-gateway', async () => {
  const selector = createAiProvider({ env: { AI_PROVIDER: 'ollama', OLLAMA_GATEWAY_VERIFIED: '1', OLLAMA_GATEWAY_TOKEN: token, OLLAMA_GATEWAY_URL: baseUrl } });
  const app = express();
  app.post('/acceptance', async (_req, res) => {
    try { res.json(await selector.generateJson({ instruction: '只回傳符合 schema 的 JSON。', data: { task: 'message 請填入測試完成。' }, schema, feature: 'smoke', requestId: randomUUID(), subject: 'synthetic-acceptance' })); }
    catch (error) { res.status(error.status || 503).json({ code: error.category || 'unavailable' }); }
  });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  try { const response = await fetch(`http://127.0.0.1:${server.address().port}/acceptance`, { method: 'POST' }); assert.equal(response.status, 200); assert.equal((await response.json()).message, '測試完成'); }
  finally { await new Promise(resolve => server.close(resolve)); }
});

if (process.argv.includes('--capacity')) {
  const probe = clients.find(item => item.project === 'capacity-probe'); assert.ok(probe, 'Capacity acceptance credential missing');
  const b = createOllamaProvider({ baseUrl, token: probe.token, logger: quiet });
  const long = { messages: [{ role: 'user', content: '請用約240字繁體中文描述一段虛構的河岸散步，不要列清單。' }], maxOutputTokens: 768, feature: 'smoke' };
  await check('real-shared-queue-and-full', async () => {
    const first = a.chat({ ...long, subject: 'queue-one' }); await until(status => status.capacity.active === 1);
    const second = a.chat({ ...question, requestId: randomUUID(), subject: 'queue-two' });
    const third = b.chat({ ...question, requestId: randomUUID(), subject: 'queue-three' });
    await until(status => status.capacity.queued === 2);
    await assert.rejects(a.chat({ ...question, requestId: randomUUID(), subject: 'queue-extra' }), error => error.category === 'queue_full');
    await Promise.all([first, second, third]); await until(status => status.capacity.active === 0);
  });
  await check('real-active-cancel-drains-before-next-project', async () => {
    const controller = new AbortController();
    const first = a.chat({ ...long, subject: 'cancel-one', signal: controller.signal }); await until(status => status.capacity.active === 1);
    controller.abort(); await assert.rejects(first, error => error.name === 'AbortError');
    await until(status => status.capacity.draining);
    const next = b.chat({ ...question, requestId: randomUUID(), subject: 'cancel-two' });
    await until(status => status.capacity.active === 1 && status.capacity.queued === 1);
    await next; await until(status => status.capacity.active === 0);
  });
}
console.log(JSON.stringify({ passed: cases.length, tests: cases, productionProviderChanged: false }));
