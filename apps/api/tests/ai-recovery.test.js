import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import { createAiRouter } from '../src/routes/ai.js';
import { AiServiceError } from '../src/services/gemini.js';

const diaryId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const valid = { summary: '平靜的記錄。', moodTrend: { description: '平靜。', dominantMood: 'calm', averageIntensity: 2 }, locationInsights: [], behaviorPatterns: [], suggestions: [] };
let base, server, findById, generated = [], reserved = 0, release, fail, wait = false, sequence = 0;
const records = Array.from({ length: 3 }, () => ({ _id: diaryId, title: 'Owned memory', text: 'private synthetic diary', mood: { type: 'calm', intensity: 2 }, createdAt: new Date() }));
before(async () => {
  process.env.JWT_SECRET = 'isolated-ai-recovery-test';
  findById = User.findById;
  User.findById = id => ({ select: () => ({ maxTimeMS: async () => ({ _id: new mongoose.Types.ObjectId(id) }) }) });
  const Diary = {
    find: query => { assert.ok(query.user); return { select: () => ({ sort: () => ({ limit: () => ({ maxTimeMS: ms => { assert.equal(ms, 5000); return { lean: async () => records }; } }) }) }) }; },
    aggregate: pipeline => ({ option: async () => {
      assert.ok(pipeline[0].$match.user);
      return [{ diaries: records, total: [{ count: 3 }], totals: [{ count: 3 }], moods: [], places: [], daily: [] }];
    } })
  };
  const app = express(); app.use(express.json());
  app.use('/ai', createAiRouter({ DiaryModel: Diary, reserve: async () => { reserved++; }, generate: async request => {
    generated.push(request);
    if (wait && request.feature === 'insights') await new Promise(resolve => { release = resolve; });
    if (fail?.feature === request.feature) throw new AiServiceError(fail.category, fail.status, fail.providerStatus);
    return request.feature === 'insights' ? valid : { answer: '你的日記記錄了平靜。[1]', citations: [diaryId] };
  } }));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/ai`;
});
after(async () => { User.findById = findById; await new Promise(resolve => server.close(resolve)); });
const userId = () => (++sequence).toString(16).padStart(24, '0');
function call(path, id = userId()) {
  return fetch(base + path, { headers: { Authorization: `Bearer ${jwt.sign({ sub: id }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' },
    ...(path === '/chat' ? { method: 'POST', body: JSON.stringify({ message: '回顧我的日記', history: [] }) } : {}) });
}

test('both features remain JWT protected', async () => {
  for (const path of ['/life-map', '/overview', '/chat']) assert.equal((await fetch(base + path, path === '/chat' ? { method: 'POST' } : {})).status, 401);
});

test('Insights and Chat succeed with unchanged response shapes, owned data and a safe request ID', async () => {
  for (const path of ['/life-map', '/chat']) {
    const response = await call(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('x-request-id'), /^[\da-f-]{36}$/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json(); assert.equal(body.success, true);
    assert.equal(path === '/life-map' ? body.data.summary : body.data.relatedDiaries[0].id, path === '/life-map' ? valid.summary : diaryId);
    assert.equal(generated.at(-1).requestId, response.headers.get('x-request-id'));
  }
});

test('provider errors stay safe and specific; upstream auth does not invalidate the user JWT', async () => {
  for (const [category, status, providerStatus] of [['provider_auth', 502, 401], ['model_not_found', 502, 404], ['quota', 429, 429], ['timeout', 504], ['provider_unavailable', 503, 503], ['invalid_response', 502]]) {
    fail = { feature: 'insights', category, status, providerStatus };
    const response = await call('/life-map');
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.code, category);
    assert.equal(body.requestId, response.headers.get('x-request-id'));
    assert.doesNotMatch(JSON.stringify(body), /Google|API.key|private synthetic|stack|providerStatus/);
  }
  fail = null;
  assert.equal((await call('/life-map')).status, 200, 'failure releases the in-flight guard');
});

test('statistics and Chat survive Insights failure; Insights survives Chat failure', async () => {
  fail = { feature: 'insights', category: 'timeout', status: 504 };
  const id = userId();
  assert.equal((await call('/life-map', id)).status, 504);
  const count = reserved;
  const stats = await call('/overview?days=30', id);
  assert.equal(stats.status, 200); assert.equal((await stats.json()).data.count, 3);
  assert.equal(reserved, count, 'statistics never consume generation quota');
  assert.equal((await call('/chat', id)).status, 200);
  fail = { feature: 'memory_chat', category: 'quota', status: 429 };
  assert.equal((await call('/chat', id)).status, 429);
  assert.equal((await call('/life-map', id)).status, 200);
  fail = null;
});

test('duplicate in-flight Insights requests do not query Gemini or consume quota; Chat stays independent', async () => {
  wait = true;
  const id = userId(), count = reserved, first = call('/life-map', id);
  while (!release) await new Promise(resolve => setTimeout(resolve, 5));
  const response = await call('/life-map', id);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'in_progress');
  assert.equal(reserved, count + 1);
  assert.equal((await call('/chat', id)).status, 200);
  release(); wait = false; release = null;
  assert.equal((await first).status, 200);
  assert.equal((await call('/life-map', id)).status, 200);
});
