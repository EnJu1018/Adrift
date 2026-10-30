import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { AiServiceError, classifyAiError, generateGeminiJson, parseGeminiJson } from '../src/services/gemini.js';
import { generateLifeMapInsight } from '../src/services/lifeMapAi.js';

const env = { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL, fallback: process.env.GEMINI_FALLBACK_MODEL };
const valid = { summary: '你在河岸留下平靜的記錄。', moodTrend: { description: '平靜為主。', dominantMood: 'calm', averageIntensity: 2 }, locationInsights: [], behaviorPatterns: [], suggestions: ['繼續記錄。'] };
let logs;
beforeEach(() => {
  process.env.GEMINI_API_KEY = 'synthetic-key-never-send';
  process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  delete process.env.GEMINI_FALLBACK_MODEL;
  logs = [];
  for (const method of ['info', 'warn']) mock.method(console, method, (...args) => logs.push(args));
});
afterEach(() => {
  mock.restoreAll();
  for (const [key, value] of [['GEMINI_API_KEY', env.key], ['GEMINI_MODEL', env.model], ['GEMINI_FALLBACK_MODEL', env.fallback]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
function response(text, extra = {}) {
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] }, ...extra }] }), { status: 200 });
}

test('real SDK request keeps the verified model and uses compatible low thinking, schema and a bounded output', async () => {
  let calls = 0;
  mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(new URL(url).pathname, '/v1beta/models/gemini-3.8-flash:generateContent');
    const body = JSON.parse(options.body), config = body.generationConfig;
    assert.deepEqual(config.thinkingConfig, { thinkingLevel: 'low' });
    assert.equal(config.temperature, undefined);
    assert.equal(config.maxOutputTokens, 4096);
    assert.deepEqual(config.responseSchema.required, Object.keys(valid));
    assert.ok(options.signal instanceof AbortSignal);
    const data = JSON.parse(body.contents[0].parts[0].text);
    assert.equal(data.diaries.length, 40);
    assert.equal(data.diaries[0].content.length, 250);
    assert.equal(JSON.stringify(data).includes('coordinates'), false);
    return response(JSON.stringify(valid));
  });
  const result = await generateLifeMapInsight(Array.from({ length: 60 }, () => ({ text: 'private-diary'.repeat(100), mood: { intensity: 2 }, location: { coordinates: [120, 24] } })), undefined, { requestId: 'test-id' });
  const { statistics, ...insight } = result;
  assert.deepEqual(insight, valid);
  assert.equal(statistics.averageIntensity, 2);
  assert.equal(calls, 1);
  assert.equal(logs[0][1].requestId, 'test-id');
  assert.equal(logs[0][1].feature, 'insights');
  assert.doesNotMatch(JSON.stringify(logs), /synthetic-key-never-send|private-diary/);
});

test('JSON fences are accepted; empty, partial, primitive and null output are never repaired or fabricated', () => {
  assert.deepEqual(parseGeminiJson('```json\n{"answer":"ok"}\n```'), { answer: 'ok' });
  for (const text of ['', '  ', undefined, '{"summary":', 'null', '[]', '"string"', 'prefix {"answer":"ok"}']) {
    assert.throws(() => parseGeminiJson(text), error => ['empty_response', 'invalid_response'].includes(error.category));
  }
});

test('Insights validates every required field and its type without substituting zeros or empty arrays', async () => {
  for (const value of [null, {}, { ...valid, summary: ' ' }, { ...valid, moodTrend: null },
    { ...valid, moodTrend: { ...valid.moodTrend, averageIntensity: '2' } },
    { ...valid, moodTrend: { ...valid.moodTrend, averageIntensity: 99 } },
    { ...valid, locationInsights: [null] }, { ...valid, behaviorPatterns: [1] }, { ...valid, suggestions: null }]) {
    await assert.rejects(generateLifeMapInsight([], undefined, { generate: async () => value }), error => error.category === 'invalid_response');
  }
});

test('provider authentication, configuration, missing model, quota and timeout never cause a model fallback or retry', async () => {
  for (const [status, category] of [[400, 'provider_config'], [401, 'provider_auth'], [403, 'provider_auth'], [404, 'model_not_found'], [429, 'quota'], [504, 'timeout']]) {
    let calls = 0;
    await assert.rejects(generateGeminiJson({ transport: async () => { calls++; throw Object.assign(new Error('sensitive upstream details'), { status }); } }), error => error.category === category && error.providerStatus === status);
    assert.equal(calls, 1);
  }
  assert.doesNotMatch(JSON.stringify(logs), /sensitive upstream details/);
});

test('empty, truncated, blocked and malformed successful provider responses are classified and not retried', async () => {
  for (const [text, extra, category] of [['', {}, 'empty_response'], ['{', {}, 'invalid_response'], ['', { finishReason: 'MAX_TOKENS' }, 'truncated_response'], ['', { finishReason: 'SAFETY' }, 'blocked_response']]) {
    let calls = 0;
    const fetch = mock.method(globalThis, 'fetch', async () => { calls++; return response(text, extra); });
    await assert.rejects(generateGeminiJson({ instruction: 'test', data: {} }), error => error.category === category);
    assert.equal(calls, 1);
    fetch.mock.restore();
  }
});

test('503 retry uses backoff, stays on the same model, succeeds once and is bounded on repeated failure', async () => {
  let calls = 0;
  const start = Date.now();
  assert.deepEqual(await generateGeminiJson({ transport: async () => { if (++calls === 1) throw Object.assign(new Error('busy'), { status: 503 }); return '{"answer":"recovered"}'; } }), { answer: 'recovered' });
  assert.equal(calls, 2);
  assert.ok(Date.now() - start >= 750);
  calls = 0;
  await assert.rejects(generateGeminiJson({ transport: async () => { calls++; throw Object.assign(new Error('busy'), { status: 503 }); } }), error => error.status === 503);
  assert.equal(calls, 2);
});

test('deadline covers retries and backoff and aborts the provider; caller cancellation never retries', async () => {
  let calls = 0, providerSignal;
  await assert.rejects(generateGeminiJson({ timeoutMs: 15, transport: async ({ signal }) => { calls++; providerSignal = signal; throw Object.assign(new Error('busy'), { status: 503 }); } }), error => error.category === 'timeout');
  assert.equal(providerSignal.aborted, true);
  assert.equal(calls, 1);
  const controller = new AbortController();
  const pending = generateGeminiJson({ signal: controller.signal, transport: ({ signal }) => { providerSignal = signal; return new Promise(() => {}); } });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(providerSignal.aborted, true);
  assert.equal(classifyAiError(new TypeError('fetch failed')).category, 'network');
  assert.equal(classifyAiError(new AiServiceError('invalid_citation')).category, 'invalid_citation');
});

test('an explicitly configured fallback is used once for availability or a retired model, never for auth, quota or malformed output', async () => {
  process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';
  for (const status of [503, 404]) {
    const models = [];
    const result = await generateGeminiJson({ transport: async ({ model }) => { models.push(model); if (models.length === 1) throw Object.assign(new Error('upstream'), { status }); return '{"answer":"recovered"}'; } });
    assert.equal(result.answer, 'recovered');
    assert.deepEqual(models, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  }
  for (const error of [new AiServiceError('provider_auth', 502, 401), new AiServiceError('quota', 429), new AiServiceError('invalid_response')]) {
    let calls = 0;
    await assert.rejects(generateGeminiJson({ transport: async () => { calls++; throw error; } }), actual => actual === error);
    assert.equal(calls, 1);
  }
  const invalidKey = classifyAiError({ status: 400, errorDetails: [{ reason: 'API_KEY_INVALID' }] });
  assert.equal(invalidKey.category, 'provider_auth');
});

test('a fallback deadline cannot extend the total deadline or start a request after user cancellation', async () => {
  process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';
  let calls = 0;
  await assert.rejects(generateGeminiJson({ timeoutMs: 15, transport: () => { calls++; return new Promise(() => {}); } }), error => error.category === 'timeout');
  assert.equal(calls, 1, 'the overall deadline wins even when a fallback is configured');
  const controller = new AbortController();
  const pending = generateGeminiJson({ signal: controller.signal, transport: async () => { calls++; throw Object.assign(new Error('busy'), { status: 503 }); } });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(calls, 2);
});

test('a stalled primary is aborted at fifteen seconds and the verified fallback can recover', async () => {
  process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';
  const models = [], started = Date.now();
  let primarySignal;
  const result = await generateGeminiJson({ transport: ({ model, signal }) => {
    models.push(model);
    if (models.length === 1) { primarySignal = signal; return new Promise(() => {}); }
    return Promise.resolve('{"answer":"recovered"}');
  } });
  assert.equal(result.answer, 'recovered');
  assert.equal(primarySignal.aborted, true);
  assert.deepEqual(models, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  assert.ok(Date.now() - started >= 15000 && Date.now() - started < 20000);
});
