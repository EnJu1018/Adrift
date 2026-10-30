import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import { createAiRouter } from '../src/routes/ai.js';
import { AiServiceError } from '../src/services/gemini.js';
import { diaryQuery } from './fixtures/diaryQuery.js';

const record = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', title: 'Owned test', text: 'Synthetic diary', mood: { type: 'calm', intensity: 2 }, createdAt: new Date() };
const records = [record, { ...record, _id: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, { ...record, _id: 'cccccccccccccccccccccccc' }];
let server, url, diagnosticCalls = 0;
before(async () => {
  const app = express(); app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/ai', createAiRouter({ auth: (req, res, next) => {
    if (!['user', 'admin', 'owner'].includes(req.headers['x-fixture-role'])) return res.sendStatus(401);
    req.user = { _id: new mongoose.Types.ObjectId(), role: req.headers['x-fixture-role'] }; next();
  }, reserve: async () => {}, generate: async () => { throw new AiServiceError('tunnel_unavailable', 503); },
  providerStatus: async ({ provider }) => { diagnosticCalls++; assert.ok(provider === undefined || provider === 'ollama'); return { provider: 'gemini', status: 'configured_not_probed' }; },
  DiaryModel: { find: () => diaryQuery(records), aggregate: () => ({ option: async () => [{ accountTotal: [{ count: 3 }], total: [{ count: 3 }], moods: [], monthly: [], places: [], daily: [], diaries: records }] }) } }));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
test('provider diagnostics require authenticated admin/owner and do not expose topology', async () => {
  assert.equal((await fetch(url + '/ai/provider-status')).status, 401);
  assert.equal((await fetch(url + '/ai/provider-status', { headers: { 'x-fixture-role': 'user' } })).status, 403);
  assert.equal(diagnosticCalls, 0);
  for (const role of ['admin', 'owner']) {
    const response = await fetch(url + '/ai/provider-status?provider=ollama', { headers: { 'x-fixture-role': role } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(JSON.stringify(await response.json()), /127\.0\.0|token|secret/);
  }
});
test('local AI connection failure leaves statistics and non-AI health available, with safe errors', async () => {
  const headers = { 'x-fixture-role': 'user', 'Content-Type': 'application/json' };
  for (const path of ['/life-map', '/chat']) {
    const response = await fetch(url + '/ai' + path, { headers, ...(path === '/chat' ? { method: 'POST', body: JSON.stringify({ message: '回顧我的日記' }) } : {}) });
    assert.equal(response.status, 503); const body = await response.json();
    assert.equal(body.code, 'tunnel_unavailable'); assert.doesNotMatch(JSON.stringify(body), /127\.0\.0|Synthetic diary|stack|token/);
  }
  const overview = await fetch(url + '/ai/overview', { headers }); assert.equal(overview.status, 200);
  assert.equal((await overview.json()).data.count, 3); assert.equal((await fetch(url + '/health')).status, 200);
});
