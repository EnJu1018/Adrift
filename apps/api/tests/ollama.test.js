import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOllamaProvider, normalizeOllamaInput, OLLAMA_MODEL, validateOllamaOutput } from '../src/services/ollama.js';
import { createAiProvider } from '../src/services/aiProvider.js';

const token = 'synthetic-gateway-token-not-a-secret-123456789';
const schema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'], additionalProperties: false };
const input = { messages: [{ role: 'user', content: '合成測試' }], format: schema };
const quiet = { info() {}, warn() {} };
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
const wire = extra => ({ model: OLLAMA_MODEL, done: true, done_reason: 'stop', message: { role: 'assistant', content: '{"answer":"測試完成"}' },
  prompt_eval_count: 25, eval_count: 10, total_duration: 2e9, load_duration: 1e8, eval_duration: 1e9, ...extra });
const raw = options => createOllamaProvider({ target: 'ollama', logger: quiet, ...options });

test('provider URLs are fixed loopback HTTP, with no credentials, redirects, arbitrary paths or public targets', () => {
  for (const baseUrl of ['https://127.0.0.1:11434', 'http://localhost:11434', 'http://evil.test', 'http://169.254.169.254', 'http://127.0.0.1/path', 'http://user:pass@127.0.0.1', 'http://127.0.0.1/?url=x']) {
    assert.throws(() => raw({ baseUrl }), error => error.category === 'configuration');
  }
  assert.throws(() => createOllamaProvider(), error => error.category === 'configuration');
  assert.throws(() => raw({ model: 'other-model' }), error => error.category === 'configuration');
});
test('4K default, explicit 8K permission, input bounds and schema validation happen before network access', () => {
  assert.equal(normalizeOllamaInput('chat', input).contextLength, 4096);
  assert.equal(normalizeOllamaInput('chat', { ...input, contextLength: 8192 }, { allow8k: true }).contextLength, 8192);
  for (const value of [{ ...input, contextLength: 8192 }, { ...input, contextLength: 262144 }, { ...input, maxOutputTokens: -1 },
    { ...input, maxOutputTokens: 1025 }, { ...input, messages: [{ role: 'user', content: '字'.repeat(2000) }] }]) {
    assert.throws(() => normalizeOllamaInput('chat', value), error => ['invalid_input', 'context_limit'].includes(error.category));
  }
  for (const value of [{ ...input, model: 'not-allowed' }, { messages: [{ role: 'system', content: 'x', images: [] }] },
    { messages: [{ role: 'user', content: ' ' }] }, { messages: [{ role: 'assistant', content: 'x' }] },
    { messages: [{ role: 'tool', content: 'x' }] }, { ...input, format: { $ref: 'https://evil.test/schema' } }, { ...input, format: { $async: true, type: 'object' } },
    { ...input, format: { type: 'string', pattern: '^(a+)+$' } }]) {
    assert.throws(() => normalizeOllamaInput('chat', value), error => error.category === 'invalid_input');
  }
});
test('raw Ollama transport uses explicit limits, no thinking output and no streaming or arbitrary options', async () => {
  let calls = 0;
  const provider = raw({ fetchImpl: async (url, options) => {
    calls++; assert.equal(url, 'http://127.0.0.1:11434/api/chat'); assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.options, { num_ctx: 4096, num_predict: 512, temperature: 0 });
    assert.equal(body.think, false); assert.equal(body.stream, false); assert.equal(body.model, OLLAMA_MODEL);
    assert.equal(body.contextLength, undefined); assert.equal(body.subject, undefined);
    return response(wire({ thinking: 'never return reasoning' }));
  } });
  const result = await provider.chat(input);
  assert.deepEqual(result.json, { answer: '測試完成' }); assert.equal(result.metrics.promptTokens, 25);
  assert.equal(result.metrics.durationMs, 2000); assert.equal(result.thinking, undefined); assert.equal(calls, 1);
});
test('generate and authenticated gateway chat expose the same bounded result contract', async () => {
  const generated = await raw({ fetchImpl: async (_url, options) => {
    assert.equal(JSON.parse(options.body).prompt, '合成測試');
    return response(wire({ response: '繁體中文', message: undefined }));
  } }).generate({ prompt: '合成測試' });
  assert.equal(generated.text, '繁體中文');
  const client = createOllamaProvider({ token, logger: quiet, fetchImpl: async (_url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.match(options.headers['X-AI-Subject'], /^[a-f\d]{64}$/);
    assert.notEqual(options.headers['X-AI-Subject'], 'user-id');
    return response({ ...generated, text: '{"answer":"完成"}' });
  } });
  assert.equal((await client.chat({ ...input, subject: 'user-id' })).json.answer, '完成');
});
test('empty, partial, fenced, invalid-schema and truncated results never get repaired or invented', async () => {
  for (const content of ['', '{', '```json\n{"answer":"x"}\n```', '{"answer":2}', '{"answer":"x","extra":1}', 'null']) {
    await assert.rejects(raw({ fetchImpl: async () => response(wire({ message: { role: 'assistant', content } })) }).chat(input),
      error => ['invalid_response', 'empty_response'].includes(error.category));
  }
  for (const extra of [{ done: false }, { done_reason: 'length' }, { model: 'other' }, { prompt_eval_count: 4095 }, { eval_count: 99999 }]) {
    await assert.rejects(raw({ fetchImpl: async () => response(wire(extra)) }).chat(input), error => ['invalid_response', 'truncated_response', 'context_limit'].includes(error.category));
  }
});
test('tool names and argument schemas are validated; tools are returned but never executed', async () => {
  const tool = { type: 'function', function: { name: 'lookup_memory', description: 'Synthetic lookup', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false } } };
  const request = normalizeOllamaInput('chat', { messages: input.messages, tools: [tool] });
  const call = { function: { name: 'lookup_memory', arguments: { query: '河邊' } } };
  assert.equal(validateOllamaOutput('chat', wire({ message: { role: 'assistant', content: '', tool_calls: [call] } }), request).toolCalls[0].function.name, 'lookup_memory');
  for (const invalid of [{ function: { name: 'shell', arguments: {} } }, { function: { name: 'lookup_memory', arguments: { query: 1 } } }, { function: { name: 'lookup_memory', arguments: '{"query":"x"}' } }]) {
    assert.throws(() => validateOllamaOutput('chat', wire({ message: { role: 'assistant', content: '', tool_calls: [invalid] } }), request), error => error.category === 'invalid_tool_call');
  }
});
test('Ollama errors are classified once with no generation retries and no sensitive logs', async () => {
  const logs = [];
  for (const [status, body, expected] of [[404, { error: 'missing' }, 'model_not_found'], [500, { error: 'CUDA out of memory' }, 'gpu_oom'],
    [401, { error: 'secret' }, 'provider_auth'], [400, { error: 'bad parameter' }, 'provider_config'], [503, {}, 'provider_unavailable'], [504, {}, 'timeout']]) {
    let calls = 0;
    const provider = raw({ logger: { info() {}, warn: (...args) => logs.push(args) }, fetchImpl: async () => { calls++; return response(body, status); } });
    await assert.rejects(provider.chat(input), error => error.category === expected && error.status !== 401);
    assert.equal(calls, 1);
  }
  assert.doesNotMatch(JSON.stringify(logs), /CUDA|合成測試|secret|Authorization/);
});
test('plain-text 5xx, malformed JSON and oversized successful bodies remain safe failures', async () => {
  for (const [body, status, category] of [['<html>proxy error</html>', 503, 'provider_unavailable'], ['{', 200, 'invalid_response'], ['a'.repeat(140000), 200, 'invalid_response']]) {
    await assert.rejects(raw({ fetchImpl: async () => new Response(body, { status }) }).chat(input), error => error.category === category);
  }
});
test('deadlines cover an uncooperative transport; caller Abort and explicit cancel release client bookkeeping', async () => {
  let signal;
  const provider = raw({ timeoutMs: 15, fetchImpl: (_url, options) => { signal = options.signal; return new Promise(() => {}); } });
  await assert.rejects(provider.chat(input), error => error.category === 'timeout'); assert.equal(signal.aborted, true);
  const controller = new AbortController();
  const pending = provider.chat({ ...input, signal: controller.signal }); controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  const cancelled = provider.chat({ ...input, requestId: 'cancel-this' });
  assert.equal(provider.cancel('cancel-this'), true);
  await assert.rejects(cancelled, error => error.name === 'AbortError'); assert.equal(provider.cancel('cancel-this'), false);
  const custom = new AbortController(); custom.abort(null);
  await assert.rejects(provider.chat({ ...input, signal: custom.signal }), error => error.name === 'AbortError');
});
test('a cold but available model is healthy without generation or a model pull', async () => {
  const paths = [];
  const provider = raw({ fetchImpl: async url => {
    paths.push(new URL(url).pathname);
    return response(url.endsWith('/version') ? { version: '0.40.13' } : url.endsWith('/show') ? { capabilities: ['completion', 'tools', 'thinking'] } : { models: [] });
  } });
  const health = await provider.healthCheck(); assert.equal(health.available, true); assert.equal(health.loaded, false);
  assert.deepEqual(paths, ['/api/version', '/api/show', '/api/ps']);
});
test('health uses one bounded availability retry; missing models never trigger download or generation', async () => {
  let calls = 0;
  await assert.rejects(raw({ fetchImpl: async () => { calls++; return response({}, 503); } }).healthCheck(), error => error.category === 'provider_unavailable');
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(raw({ fetchImpl: async () => { calls++; return response({}, 404); } }).healthCheck(), error => error.category === 'model_not_found');
  assert.equal(calls, 1);
});
test('default provider stays Gemini and does not instantiate or probe Ollama', async () => {
  let calls = 0;
  const provider = createAiProvider({ env: {}, gemini: async () => { calls++; return { answer: 'existing provider' }; }, ollamaFactory() { throw new Error('must not load'); } });
  assert.equal((await provider.generateJson({})).answer, 'existing provider'); assert.equal(calls, 1);
  assert.equal((await provider.status()).provider, 'gemini');
});
test('Ollama requires explicit verification, never falls back to Gemini and converts existing schemas', async () => {
  const env = { AI_PROVIDER: 'ollama' };
  let clouds = 0;
  const provider = createAiProvider({ env, gemini: async () => { clouds++; }, ollamaFactory: () => ({ chat: async request => {
    assert.equal(request.format.type, 'object'); assert.equal(request.format.properties.answer.type, 'string');
    throw new Error('Local inference unavailable');
  } }) });
  await assert.rejects(provider.generateJson({}), error => error.category === 'configuration');
  env.OLLAMA_GATEWAY_VERIFIED = '1';
  await assert.rejects(provider.generateJson({ instruction: 'test', data: {}, schema: { type: 'OBJECT', properties: { answer: { type: 'STRING' } } } }), /Local inference unavailable/);
  assert.equal(clouds, 0);
});
test('admin diagnostics strip addresses, tokens and untrusted upstream fields', async () => {
  const provider = createAiProvider({ env: { AI_PROVIDER: 'ollama', OLLAMA_GATEWAY_VERIFIED: '1' }, ollamaFactory: () => ({ healthCheck: async () => ({
    reachable: true, status: 'available', address: 'internal-host', token,
    upstream: { reachable: true, available: true, loaded: false, address: 'internal-host', token }, capacity: { active: 0, queued: 0, secret: token }
  }) }) });
  assert.doesNotMatch(JSON.stringify(await provider.status()), /internal-host|synthetic-gateway|secret/);
});
test('read-only local readiness can be probed while Gemini remains selected and generation is not verified', async () => {
  let clouds = 0, probes = 0;
  const provider = createAiProvider({ env: {}, gemini: async () => { clouds++; return {}; }, ollamaFactory: () => ({ healthCheck: async () => {
    probes++; return { reachable: true, status: 'cold', upstream: { available: true, loaded: false }, capacity: { active: 0, queued: 0 } };
  } }) });
  assert.equal((await provider.status({ provider: 'ollama' })).provider, 'ollama');
  await provider.generateJson({}); assert.equal(clouds, 1); assert.equal(probes, 1);
  await assert.rejects(provider.status({ provider: 'evil' }), error => error.status === 400);
});
