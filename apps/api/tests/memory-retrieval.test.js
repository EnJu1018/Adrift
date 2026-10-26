import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import Diary from '../src/models/Diary.js';
import { answerMemoryQuestion, planMemoryQuestion, retrieveMemories } from '../src/services/memoryChat.js';
import { getIntelligenceOverview } from '../src/services/intelligenceOverview.js';
import { AiServiceError } from '../src/services/gemini.js';

const uri = process.env.MEMORY_TEST_MONGO_URI;
const integration = (name, fn) => test(name, { skip: !uri }, fn);
const now = new Date('2026-10-26T04:00:00Z');
const [owner, other, single, empty, gaps, boundary] = Array.from({ length: 6 }, () => new mongoose.Types.ObjectId());
let created;
const fixture = (user, values = {}) => ({ user, title: '生活片段', text: '在河邊散步，整理今天的想法。', mood: { type: 'calm', intensity: 2 },
  location: { type: 'Point', coordinates: [120, 24], placeName: '臺北河岸' }, visibility: 'private', createdAt: now, ...values });
before(async () => {
  if (!uri) return;
  const url = new URL(uri);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/adrift_memory_test_')) throw new Error('Memory tests require an isolated loopback test database');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.dropDatabase();
  created = await Diary.create(Array.from({ length: 50 }, (_, index) => fixture(owner, {
    title: `生活片段 ${index}`, text: index === 7 ? '跟組員忙了很久，今天終於完成作品，感覺所有努力都有了成果。' : `第 ${index} 則：在河邊散步，整理工作與閱讀筆記。`.repeat(60),
    mood: { type: ['joy', 'calm', 'sad', 'anxious', 'confused'][index % 5], intensity: index % 5 + 1 },
    visibility: ['private', 'friends', 'public'][index % 3],
    location: { type: 'Point', coordinates: [120, 24], placeName: index % 2 ? '臺中學校' : '台北河岸' },
    createdAt: new Date(Date.UTC(2025, 10 + index % 12, 15, 4))
  })));
  await Diary.create([
    fixture(other, { title: 'OTHER PRIVATE SECRET', text: 'NEVER DISCLOSE OTHER ACCOUNT' }),
    fixture(single, { text: '跟組員完成專題，努力有了成果。' }),
    fixture(gaps, { createdAt: new Date('2026-05-01T04:00:00Z') }), fixture(gaps, { createdAt: new Date('2026-06-01T04:00:00Z') }),
    ...['2026-09-30T15:59:59.999Z', '2026-09-30T16:00:00Z', '2026-10-01T15:59:59.999Z', '2026-10-01T16:00:00Z'].map(value => fixture(boundary, { createdAt: new Date(value) }))
  ]);
});
after(async () => { if (uri) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } });
const retrieve = (question, user = owner, history = []) => retrieveMemories(Diary, user, planMemoryQuestion(question, history, now));
const reply = options => answerMemoryQuestion({ message: '回顧我的日記', history: [], userId: owner, Diary, reserve: async () => {}, now, ...options });
const generate = async request => ({ answer: `日記記錄了實際的生活片段。[1]`, citations: [request.data.diaries[0].id] });

integration('fifty owned records across a year include every visibility and full-month statistics, not question-keyword matches', async () => {
  const result = await retrieve('幫我深入回顧最近一年的心情變化');
  assert.equal(result.total, 50); assert.equal(result.accountTotal, 50);
  assert.equal(result.moods.reduce((sum, row) => sum + row.count, 0), 50);
  assert.equal(result.monthly.reduce((sum, row) => sum + row.count, 0), 50);
  assert.equal(result.monthly.filter(row => row.count > 0).length, 12);
  const source = new Map(created.map(item => [String(item._id), item]));
  assert.ok(result.diaries.every(item => source.has(item.id)));
  assert.ok(result.diaries.some(item => source.get(item.id).visibility === 'private'));
  assert.ok(result.diaries.some(item => source.get(item.id).visibility === 'friends'));
  assert.ok(new Set(result.diaries.map(item => item.createdAt.toISOString().slice(0, 7))).size >= 10);
  assert.doesNotMatch(JSON.stringify(result), /OTHER PRIVATE|NEVER DISCLOSE|coordinates/);
});
integration('month, half-year and year requests produce distinct counts and elliptical follow-ups use the same new range', async () => {
  const month = await retrieve('最近一個月的心情如何？');
  const half = await retrieve('最近半年的心情如何？');
  const year = await retrieve('最近一年的心情如何？');
  assert.equal(month.total, 4); assert.equal(half.total, 24); assert.equal(year.total, 50);
  assert.equal((await retrieve('半年來', owner, ['最近一個月的心情如何？'])).total, half.total);
  assert.equal((await retrieve('再深入一點', owner, ['最近一個月的心情如何？', '半年來'])).total, half.total);
});
integration('Taipei day boundaries are inclusive through the last millisecond and exclude the next local day', async () => {
  assert.equal((await retrieve('回顧 2026-10-01 的日記', boundary)).total, 2);
  assert.equal((await retrieve('回顧 2026-09-30 到 2026-10-01 的日記', boundary)).total, 3);
});
integration('Chat and Insights use identical owned records, mood distribution and weighted valid intensities for the same period', async () => {
  const overview = await getIntelligenceOverview(Diary, owner, '30', now);
  const result = await retrieve('最近30天的心情如何？');
  assert.equal(result.total, overview.count);
  assert.deepEqual(Object.fromEntries(result.moods.map(row => [row._id, row.count])), Object.fromEntries(overview.moods.map(row => [row.type, row.count])));
  const expected = overview.daily.reduce((sum, row) => sum + row.averageIntensity * row.intensityCount, 0) / overview.daily.reduce((sum, row) => sum + row.intensityCount, 0);
  const actual = result.monthly.reduce((sum, row) => sum + (row.averageIntensity || 0) * row.intensityCount, 0) / result.monthly.reduce((sum, row) => sum + row.intensityCount, 0);
  assert.equal(actual, expected);
});
integration('a single private diary is enough for a grounded answer; three-entry Insights threshold is not applied', async () => {
  let calls = 0;
  const answer = await reply({ userId: single, generate: async request => {
    calls++; assert.match(request.data.diaries[0].content, /完成專題/); return generate(request);
  } });
  assert.equal(calls, 1); assert.equal(answer.status, 'success'); assert.equal(answer.matchedCount, 1); assert.equal(answer.relatedDiaries.length, 1);
});
integration('no account diaries and no matching diaries have different evidence states and never invoke Gemini', async () => {
  const forbidden = async () => { throw new Error('must not reserve or generate'); };
  const none = await reply({ userId: empty, reserve: forbidden, generate: forbidden });
  const noMatch = await reply({ message: '回顧 2024年6月的日記', reserve: forbidden, generate: forbidden });
  assert.equal(none.evidence.status, 'NO_DIARIES'); assert.equal(none.evidence.totalCount, 0);
  assert.equal(noMatch.evidence.status, 'NO_MATCHES'); assert.equal(noMatch.evidence.totalCount, 50);
  assert.doesNotMatch(noMatch.answer, /第一篇/);
});
integration('sparse months retain exact zero-data gaps and partial evidence still gets a grounded analysis', async () => {
  const result = await reply({ message: '深入分析最近半年的心情變化', userId: gaps, generate: async request => {
    assert.equal(request.data.evidence.status, 'INSUFFICIENT_EVIDENCE');
    assert.equal(request.data.evidence.monthly.find(row => row.month === '2026-08').count, 0);
    assert.equal(request.data.evidence.monthly.find(row => row.month === '2026-08').averageIntensity, null);
    return generate(request);
  } });
  assert.equal(result.status, 'success'); assert.equal(result.matchedCount, 2);
});
integration('Gemini receives real diary text and complete counts within a fixed context budget, without other account data', async () => {
  await reply({ message: '深入分析最近一年的心情變化', generate: async request => {
    assert.equal(request.data.evidence.matchedCount, 50);
    assert.ok(request.data.diaries.length <= 16);
    assert.ok(request.data.diaries.some(item => item.content.includes('完成作品')));
    assert.ok(request.data.diaries.every(item => item.content.length > 0));
    assert.ok(JSON.stringify(request.data).length <= 24000);
    assert.doesNotMatch(JSON.stringify(request.data), /OTHER PRIVATE|NEVER DISCLOSE|coordinates/);
    assert.match(request.instruction, /不可信資料/); assert.match(request.instruction, /不等於因果/);
    return generate(request);
  } });
  await reply({ message: `深入分析最近一年的心情變化，${'請對照記錄。'.repeat(140)}`,
    history: Array.from({ length: 12 }, () => '再深入一點，請整理有根據的生活回憶。'.repeat(50)),
    generate: async request => {
      assert.ok(JSON.stringify(request.data).length <= 24000);
      assert.equal(request.data.evidence.matchedCount, 50);
      assert.ok(request.data.diaries.every(item => item.content.length > 0));
      return generate(request);
    }
  });
});
integration('literal content retrieval searches diary bodies; city and mood follow-ups replace their specific constraint', async () => {
  const event = await retrieve('找出提到「作品」的日記');
  assert.equal(event.total, 1); assert.match(event.diaries[0].content, /終於完成作品/);
  const city = await retrieve('那臺中呢？', owner, ['我在臺北有哪些回憶？']);
  assert.equal(city.total, 25); assert.ok(city.diaries.every(item => item.place === '臺中學校'));
  const mood = await retrieve('那難過的呢？', owner, ['最近一年有哪些快樂的日記？']);
  assert.equal(mood.total, 10); assert.ok(mood.diaries.every(item => item.mood.type === 'sad'));
});
integration('retrieval errors and model errors never masquerade as empty results; generated facts survive an AI failure', async () => {
  await assert.rejects(reply({ Diary: { aggregate() { throw new Error('database outage'); } }, generate }), error => error.category === 'retrieval');
  await assert.rejects(reply({ generate: async () => { throw new AiServiceError('quota', 429); } }), error => {
    assert.equal(error.category, 'quota'); assert.equal(error.evidence.matchedCount, 50);
    assert.doesNotMatch(JSON.stringify(error.evidence), /生活片段|content|text/); return true;
  });
});
integration('citations outside retrieved owner evidence and missing inline source numbers fail closed', async () => {
  const privateOther = await Diary.findOne({ user: other }).lean();
  for (const result of [{ answer: '不允許。[1]', citations: [String(privateOther._id)] }, { answer: '沒有引用編號。', citations: [String(created[0]._id)] }]) {
    await assert.rejects(reply({ generate: async () => result }), error => error.category === 'invalid_citation');
  }
});
