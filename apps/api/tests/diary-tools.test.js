import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDiaryToolSession, diaryToolContracts, diaryToolDefinitions } from '../src/services/diaryTools.js';
import { diaryToolContext, runDiaryToolTurn } from '../src/services/diaryToolCalling.js';
import { createAiProvider } from '../src/services/aiProvider.js';
import { compileOutputSchema } from '../src/services/ollama.js';
import { diaryQuery } from './fixtures/diaryQuery.js';

const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa', id = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const now = new Date('2026-10-30T04:00:00Z');
const row = { _id: id, title: '完整標題', text: '內容'.repeat(1000), mood: { type: 'joy', intensity: 4 },
  createdAt: now, updatedAt: now, visibility: 'private', location: { placeName: '臺北' } };
const log = { warn() {} };
const session = (Diary = { find: () => diaryQuery([row]) }, options = {}) => createDiaryToolSession({ user: { _id: owner } }, { Diary, now: () => now, logger: log, ...options });
const names = diaryToolDefinitions().map(tool => tool.function.name);
const args = name => name === 'get_diary_details' ? { diaryIds: [id] } : { timeRange: 'all_time', ...(name.includes('statistics') || name.includes('timeline') ? { groupBy: 'month' } : {}) };

test('four bounded contracts compile as Ollama tools and copies cannot mutate the registry', () => {
  assert.equal(names.length, 4);
  for (const definition of diaryToolDefinitions()) assert.equal(typeof compileOutputSchema(definition.function.parameters), 'function');
  const copy = diaryToolDefinitions(); copy[0].function.parameters.properties.userId = { type: 'string' };
  assert.equal(diaryToolDefinitions()[0].function.parameters.properties.userId, undefined);
  for (const contract of diaryToolContracts()) assert.match(contract.authorization, /owner only/);
});
test('session identity comes only from authenticated req.user, not body, query or arguments', () => {
  for (const req of [{}, { body: { userId: owner } }, { query: { userId: owner } }, { user: { _id: { $ne: null } } }]) {
    assert.throws(() => createDiaryToolSession(req, { Diary: {} }), error => error.category === 'unauthorized');
  }
});
for (const name of names) {
  test(`${name}: missing input and forged owner/operators/projection are rejected before any DB read`, async () => {
    const tool = session({ find() { throw new Error('must not query'); }, aggregate() { throw new Error('must not query'); } });
    for (const value of [undefined, null, {}, [], { ...args(name), userId: owner }, { ...args(name), collection: 'users' },
      { ...args(name), $where: 'return true' }, { ...args(name), projection: { passwordHash: 1 } }]) {
      assert.equal((await tool.execute(name, value)).status, 'INVALID_ARGUMENTS');
    }
  });
  test(`${name}: DB failures are errors, never fake no-results, and logs contain no input text`, async () => {
    const logs = [], broken = () => { throw new Error('SECRET mongo://private password JWT'); };
    const result = await session({ find: broken, aggregate: broken }, { logger: { warn: (...items) => logs.push(items) } }).execute(name, args(name));
    assert.equal(result.status, 'RETRIEVAL_ERROR');
    assert.doesNotMatch(JSON.stringify([result, logs]), /SECRET|mongo:|password|JWT/);
  });
}
for (const [label, input] of [
  ['bad mood', { mood: 'happy' }], ['Mongo operator', { city: { $ne: null } }], ['oversized limit', { limit: 11 }],
  ['string limit', { limit: '2' }], ['wrong sort', { sort: 'intensity' }], ['unknown cursor', { cursor: 'a'.repeat(36) }],
  ['empty place', { place: ' ' }], ['too many terms', { keywords: ['a', 'b', 'c', 'd', 'e'] }],
  ['impossible date', { timeRange: 'custom', startDate: '2026-02-30', endDate: '2026-03-01' }],
  ['reverse range', { timeRange: 'custom', startDate: '2026-03-02', endDate: '2026-03-01' }],
  ['missing custom end', { timeRange: 'custom', startDate: '2026-03-01' }],
  ['guessed timestamp', { timeRange: 'custom', startDate: '2026-03-01T00:00:00Z', endDate: '2026-03-02' }],
  ['conflicting range', { startDate: '2026-03-01', endDate: '2026-03-02' }], ['wrong timezone', { timezone: 'UTC' }]
]) test(`search rejects ${label}`, async () => assert.equal((await session().execute('search_diaries', { timeRange: 'all_time', ...input })).status, 'INVALID_ARGUMENTS'));
test('details reject invalid IDs and more than two diaries', async () => {
  for (const diaryIds of [['z'.repeat(24)], [id, id, id], [], [12]]) assert.equal((await session().execute('get_diary_details', { diaryIds })).status, 'INVALID_ARGUMENTS');
});
test('unknown, inherited and write tool names are never executed', async () => {
  for (const name of ['delete_diary', '__proto__', 'constructor', 'shell', 'find']) assert.equal((await session().execute(name, {})).status, 'NOT_FOUND');
});
test('search truncates, details preserve all 2000 characters, output contains only allowed fields', async () => {
  const tool = session();
  const search = await tool.execute('search_diaries', args('search_diaries'));
  const full = await tool.execute('get_diary_details', args('get_diary_details'));
  assert.equal(search.status, 'SUCCESS'); assert.equal(search.data.diaries[0].content.length, 180);
  assert.equal(full.data.diaries[0].content, row.text); assert.equal(full.data.diaries[0].contentTruncated, false);
  assert.equal(full.sources[0].end, 2000); assert.equal(full.sources[0].createdAt, now.toISOString());
  assert.doesNotMatch(JSON.stringify(full), /coordinates|passwordHash|userId|\.env/);
});
test('invalid retrieval output cannot cross the tool boundary', async () => {
  assert.equal((await session({ find: () => diaryQuery([{ ...row, title: 'x'.repeat(51) }]) }).execute('get_diary_details', { diaryIds: [id] })).status, 'RETRIEVAL_ERROR');
});
test('deadline, cancellation and database maxTimeMS failures return TIMEOUT', async () => {
  let release;
  const tool = session({ find: () => ({ ...diaryQuery([]), lean: () => new Promise(resolve => { release = resolve; }) }) }, { timeoutMs: 10 });
  assert.equal((await tool.execute('search_diaries', { timeRange: 'all_time' })).status, 'TIMEOUT');
  assert.equal((await tool.execute('search_diaries', { timeRange: 'all_time' })).status, 'INVALID_ARGUMENTS', 'timed-out DB work is not duplicated');
  release([row]); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(tool.validateCitations([{ id, start: 0, end: 2, quote: '內容' }]), error => error.category === 'invalid_citation');
  const abort = new AbortController(); abort.abort();
  assert.equal((await session().execute('search_diaries', args('search_diaries'), { signal: abort.signal })).status, 'TIMEOUT');
  const timed = session({ find: () => { throw Object.assign(new Error('expired'), { code: 50 }); } });
  assert.equal((await timed.execute('search_diaries', args('search_diaries'))).status, 'TIMEOUT');
});
test('closed sessions and call budgets cannot be bypassed', async () => {
  const tool = session();
  for (let i = 0; i < 32; i++) assert.equal((await tool.execute('search_diaries', args('search_diaries'))).status, 'SUCCESS');
  assert.equal((await tool.execute('search_diaries', args('search_diaries'))).status, 'INVALID_ARGUMENTS');
  tool.close(); assert.equal((await tool.execute('search_diaries', args('search_diaries'))).status, 'UNAUTHORIZED');
  await assert.rejects(tool.validateCitations([{ id, start: 0, end: 2, quote: '內容' }]), error => error.category === 'unauthorized');
});
test('model context stays bounded and explicitly marks excerpt and collection omissions', async () => {
  const full = await session().execute('get_diary_details', args('get_diary_details'));
  const packed = diaryToolContext(full, { maxBytes: 1800 });
  assert.ok(Buffer.byteLength(packed) <= 1800); assert.equal(JSON.parse(packed).metadata.contextTruncated, true);
  assert.ok(JSON.parse(packed).data.diaries[0].content.length <= 120);
  assert.equal(JSON.parse(packed).data.diaries[0].createdAt, '2026-10-30T12:00:00.000+08:00');
  assert.throws(() => diaryToolContext(full, { maxBytes: 2 }), error => error.category === 'invalid_input');
});
test('malformed model arguments are rejected by the backend without executing the database', async () => {
  let reads = 0;
  const tool = session({ find() { reads++; throw new Error('must not read'); } });
  const provider = { chat: async () => ({ toolCalls: [{ function: { name: 'search_diaries', arguments: { timeRange: 'all_time', userId: owner } } }] }) };
  const turn = await runDiaryToolTurn({ provider, session: tool, question: '搜尋日記', contextLength: 8192, allow8k: true });
  assert.equal(turn.result.status, 'INVALID_ARGUMENTS'); assert.equal(reads, 0);
});
test('cancellation during a running read never registers late evidence', async () => {
  let release;
  const tool = session({ find: () => ({ ...diaryQuery([]), lean: () => new Promise(resolve => { release = resolve; }) }) });
  const controller = new AbortController();
  const pending = tool.execute('search_diaries', { timeRange: 'all_time' }, { signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  assert.equal((await pending).status, 'TIMEOUT'); release([row]); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(tool.validateCitations([{ id, start: 0, end: 2, quote: '內容' }]), error => error.category === 'invalid_citation');
});
test('large allowed pages stay bounded and model-context omissions are explicit', async () => {
  const records = Array.from({ length: 10 }, (_, i) => ({ ...row, _id: i.toString(16).padStart(24, '0'), text: '字'.repeat(2000), title: '字'.repeat(50), location: { placeName: '字'.repeat(120) } }));
  const result = await session({ find: () => diaryQuery(records) }).execute('search_diaries', { timeRange: 'all_time', limit: 10 });
  assert.equal(result.status, 'SUCCESS'); assert.ok(Buffer.byteLength(JSON.stringify(result)) < 49152);
  const packed = JSON.parse(diaryToolContext(result, { maxBytes: 1800 }));
  assert.ok(packed.metadata.omittedDiaries > 0); assert.equal(packed.metadata.contextTruncated, true);
  assert.equal(packed.count, 10, 'the original page count must not be invented from the context subset');
});
test('one explicit model tool call executes through the backend; multiple calls execute nothing', async () => {
  let requests = 0;
  const provider = { chat: async () => { requests++; return { toolCalls: [{ function: { name: 'search_diaries', arguments: { timeRange: 'last_6_months', city: '臺北' } } }], metrics: { outputTokens: 30 } }; } };
  const tool = session();
  const result = await runDiaryToolTurn({ provider, session: tool, question: '找最近半年臺北日記', contextLength: 8192, allow8k: true });
  assert.equal(result.result.status, 'SUCCESS'); assert.equal(requests, 1);
  let executed = 0;
  for (const toolCalls of [[], [{ function: { name: 'delete_diary', arguments: {} } }], [{}, {}]]) {
    await assert.rejects(runDiaryToolTurn({ provider: { chat: async () => ({ toolCalls }) }, session: { ...tool, execute() { executed++; } }, question: '回顧日記', contextLength: 8192, allow8k: true }), error => error.category === 'invalid_tool_call');
  }
  assert.equal(executed, 0);
});
test('4K subset works; four verbose schemas need explicit 8K and never silently enlarge context', async () => {
  const provider = { chat: async () => ({ toolCalls: [{ function: { name: 'search_diaries', arguments: { timeRange: 'all_time' } } }] }) };
  assert.equal((await runDiaryToolTurn({ provider, session: session(), question: '搜尋日記', toolNames: ['search_diaries'] })).result.status, 'SUCCESS');
  await assert.rejects(runDiaryToolTurn({ provider, session: session(), question: '搜尋日記' }), error => error.category === 'context_limit');
  await assert.rejects(runDiaryToolTurn({ provider, session: session(), question: '搜尋日記', contextLength: 8192 }), error => error.category === 'invalid_input');
});
test('tool capability is explicit local-only and never calls Gemini on error', async () => {
  let cloud = 0, local = 0;
  const gemini = async () => { cloud++; };
  assert.throws(() => createAiProvider({ env: {}, gemini }).chatTools({}), error => error.category === 'configuration');
  assert.throws(() => createAiProvider({ env: { AI_PROVIDER: 'ollama' }, gemini }).chatTools({}), error => error.category === 'configuration');
  const provider = createAiProvider({ env: { AI_PROVIDER: 'ollama', OLLAMA_GATEWAY_VERIFIED: '1' }, gemini,
    ollamaFactory: () => ({ chat: async () => { local++; throw new Error('offline'); } }) });
  await assert.rejects(provider.chatTools({})); assert.equal(cloud, 0); assert.equal(local, 1);
});
