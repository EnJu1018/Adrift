import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiError, readApiPayload } from './errors.js';

const id = 'a0c734cc-0f91-4038-b8ac-fb6fb007238a';

test('HTML, empty, malformed, primitive and array bodies are never treated as a successful payload', async () => {
  for (const [body, type] of [['<html>502 Bad Gateway secret</html>', 'text/html'], ['', 'application/json'],
    ['{"success":', 'application/json'], ['[]', 'application/json'], ['null', 'application/json'], ['"hello"', 'application/json']]) {
    assert.equal(await readApiPayload(new Response(body, { headers: { 'content-type': type } })), null);
  }
  assert.deepEqual(await readApiPayload(Response.json({ success: true, data: {} })), { success: true, data: {} });
  assert.deepEqual(await readApiPayload(new Response('{"code":"quota"}', { headers: { 'content-type': 'application/problem+json' } })), { code: 'quota' });
});

test('HTTP/2 empty status text and non-JSON proxy errors have localized, safe messages', () => {
  for (const status of [401, 403, 404, 409, 429, 500, 502, 503, 504]) {
    const error = apiError({ status, requestId: id });
    assert.match(error.message, /[\u3400-\u9fff]/);
    assert.doesNotMatch(error.message, /Request failed|Bad Gateway|secret|undefined/);
    assert.equal(error.status, status); assert.equal(error.requestId, id);
  }
});

test('classified errors preserve request ID and authorized recovery context but hide upstream diagnostics', () => {
  const payload = { success: false, code: 'invalid_citation', message: 'Request failed', stage: 'AI_ERROR',
    requestId: 'f'.repeat(32), data: { queryContext: { mood: 'calm' }, evidence: { matchedCount: 3 } },
    stack: 'private diary text', server: 'internal-host', apiKey: 'sensitive-key' };
  const error = apiError({ status: 502, payload, requestId: id, retryAfter: '12' });
  assert.equal(error.code, 'invalid_citation'); assert.equal(error.requestId, id); assert.equal(error.retryAfter, 12);
  assert.match(error.message, /引用/); assert.deepEqual(error.payload.data, payload.data);
  assert.equal(error.payload.stage, 'AI_ERROR'); assert.doesNotMatch(JSON.stringify(error), /private diary|internal-host|sensitive-key/);
  const diagnostics = apiError({ status: 503, payload: { data: { token: 'private-secret', evidence: { matchedCount: 1 } } } });
  assert.deepEqual(diagnostics.payload.data, { evidence: { matchedCount: 1 } });
  assert.equal(apiError({ status: 502, payload: { message: 'API key: secret' } }).message.includes('secret'), false);
  assert.equal(apiError({ status: 400, payload: { message: '請輸入有效的 Email。' } }).message, '請輸入有效的 Email。');
  assert.equal(apiError({ requestId: '<script>not-an-id</script>' }).requestId, undefined);
});

test('network and timeout failures are distinct and retry-after cannot overflow', () => {
  assert.notEqual(apiError({ code: 'network' }).message, apiError({ code: 'timeout' }).message);
  assert.equal(apiError({ code: 'timeout' }).code, 'timeout');
  assert.equal(apiError({ retryAfter: '999999999' }).retryAfter, 3600);
  assert.equal(apiError({ retryAfter: 'not a date' }).retryAfter, undefined);
});
