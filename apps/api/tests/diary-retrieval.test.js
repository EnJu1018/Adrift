import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import Diary from '../src/models/Diary.js';
import User from '../src/models/User.js';
import { createAiRouter } from '../src/routes/ai.js';
import { getAuthorizedDiaryDetails, getDiaryTimeline, getEmotionStatistics, searchUserDiaries, validateDiaryCitations } from '../src/services/diaryRetrieval.js';
import { answerMemoryQuestion, retrieveMemories } from '../src/services/memoryChat.js';
import { planMemoryQuestion, validateQueryContext } from '../src/services/memoryQuery.js';
import { getIntelligenceOverview } from '../src/services/intelligenceOverview.js';
import { generateLifeMapInsight } from '../src/services/lifeMapAi.js';

const uri = process.env.DIARY_RETRIEVAL_TEST_MONGO_URI;
const integration = (name, fn) => test(name, { skip: !uri }, fn);
const now = new Date('2026-10-30T04:00:00Z');
const [owner, other, empty, single, paging, boundaries, sparse, places, medium, large] = Array.from({ length: 10 }, () => new mongoose.Types.ObjectId());
const base = user => ({ user, title: '完整標題', text: '真實生活片段。', mood: { type: 'calm', intensity: 2 },
  location: { type: 'Point', coordinates: [120, 24], placeName: '臺中學校' }, visibility: 'private', createdAt: now, updatedAt: now });
let owned, foreign, one, pageRecords, full;
before(async () => {
  if (!uri) return;
  const url = new URL(uri);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/adrift_retrieval_test_')) throw new Error('Retrieval tests require an isolated loopback test database');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.dropDatabase();
  owned = await Diary.create(Array.from({ length: 50 }, (_, index) => ({ ...base(owner), title: `生活事件 ${index}`,
    text: index === 0 ? '開始準備第一個作品，和組員整理方向。' : `生活記錄 ${index}`,
    createdAt: new Date(Date.UTC(2025, 10 + index % 12, 10, 4)),
    mood: { type: ['joy', 'calm', 'sad', 'anxious', 'confused'][index % 5], intensity: index % 5 + 1 },
    visibility: ['private', 'friends', 'public'][index % 3] })));
  foreign = await Diary.create(['private', 'friends', 'public'].map(visibility => ({ ...base(other), visibility, text: 'OTHER ACCOUNT SECRET' })));
  one = await Diary.create(base(single));
  pageRecords = await Diary.create(Array.from({ length: 51 }, () => base(paging)));
  await Diary.create(['2025-12-31T15:59:59.999Z', '2025-12-31T16:00:00Z', '2026-01-01T15:59:59.999Z', '2026-01-01T16:00:00Z'].map(value => ({ ...base(boundaries), createdAt: new Date(value) })));
  await Diary.create(['2026-05-10T04:00:00Z', '2026-06-10T04:00:00Z'].map(value => ({ ...base(sparse), createdAt: new Date(value) })));
  [full] = await Diary.create([
    { ...base(places), title: '標'.repeat(50), text: '內'.repeat(2000), location: { ...base(places).location, placeName: '台北河岸' } },
    { ...base(places), text: '想到臺北的朋友，但今天人在臺中。' },
    { ...base(places), text: '.* 是文字，不是正規表示式。', location: { ...base(places).location, placeName: '澳洲墨爾本' } }
  ]);
  await Diary.insertMany([...[medium, large].flatMap((user, group) => Array.from({ length: group ? 5000 : 500 }, (_, index) => ({ ...base(user), visibility: ['private', 'friends', 'public'][index % 3] })))]);
});
after(async () => { if (uri) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } });

integration('owner filter includes every owned visibility and excludes every other-account visibility', async () => {
  const stats = await getEmotionStatistics(Diary, owner, { asOf: now });
  assert.equal(stats.accountTotal, 50); assert.equal(stats.total, 50);
  assert.equal(stats.moods.reduce((sum, item) => sum + item.count, 0), 50);
  for (const diary of owned.filter((_, index) => index < 3)) {
    const [record] = await getAuthorizedDiaryDetails(Diary, String(owner), [String(diary._id)]);
    assert.equal(record.visibility, diary.visibility);
  }
  for (const diary of foreign) await assert.rejects(getAuthorizedDiaryDetails(Diary, owner, [String(diary._id)]), error => error.code === 'UNAUTHORIZED' && error.status === 403);
  await assert.rejects(getAuthorizedDiaryDetails(Diary, owner, [String(owned[0]._id), String(foreign[2]._id)]), error => error.code === 'UNAUTHORIZED');
});
integration('missing or malformed owner identities fail before touching the database', async () => {
  const forbidden = { aggregate() { throw new Error('must not query'); }, find() { throw new Error('must not query'); } };
  for (const identity of [null, '', 'not-an-id', { $ne: null }]) {
    for (const invoke of [() => getEmotionStatistics(forbidden, identity), () => searchUserDiaries(forbidden, identity), () => getAuthorizedDiaryDetails(forbidden, identity, [String(one._id)])]) {
      await assert.rejects(invoke(), error => error.code === 'UNAUTHORIZED' && error.status === 401);
    }
  }
});
integration('full titles and bodies carry immutable verifiable source metadata without coordinates', async () => {
  const [record] = await getAuthorizedDiaryDetails(Diary, places, [String(full._id)]);
  assert.equal(record.title, '標'.repeat(50)); assert.equal(record.content, '內'.repeat(2000));
  assert.equal(record.source.field, 'text'); assert.equal(record.source.start, 0); assert.equal(record.source.end, 2000);
  assert.match(record.source.revision, /^[a-f\d]{64}$/);
  assert.equal(record.contentTruncated, false); assert.doesNotMatch(JSON.stringify(record), /coordinates|passwordHash/);
});
integration('keyset pages neither lose nor repeat identical-timestamp records in either direction', async () => {
  for (const order of ['asc', 'desc']) {
    const ids = []; let cursor = null;
    do {
      const page = order === 'asc' ? await getDiaryTimeline(Diary, paging, { asOf: now }, { limit: 7, cursor })
        : await searchUserDiaries(Diary, paging, { asOf: now }, { limit: 7, cursor });
      assert.equal(page.asOf.toISOString(), now.toISOString());
      ids.push(...page.diaries.map(item => item.id)); cursor = page.nextCursor;
    } while (cursor);
    const expected = pageRecords.map(item => String(item._id)).sort(); if (order === 'desc') expected.reverse();
    assert.deepEqual(ids, expected); assert.equal(new Set(ids).size, 51);
  }
});
integration('foreign cursors cannot bypass ownership and new records stay outside a pinned asOf', async () => {
  const page = await searchUserDiaries(Diary, owner, { asOf: now }, { cursor: `${now.toISOString()}|${foreign[0]._id}` });
  assert.ok(page.diaries.every(item => owned.some(source => String(source._id) === item.id)));
  const first = await searchUserDiaries(Diary, paging, { asOf: now }, { limit: 50 });
  const future = await Diary.create({ ...base(paging), createdAt: new Date(now.getTime() + 1) });
  try {
    const next = await searchUserDiaries(Diary, paging, { asOf: first.asOf }, { limit: 50, cursor: first.nextCursor });
    assert.equal(next.diaries.length, 1); assert.ok(!next.diaries.some(item => item.id === String(future._id)));
  } finally { await Diary.deleteOne({ _id: future._id }); }
});
integration('invalid filters, pagination and ids are rejected rather than becoming broad queries', async () => {
  for (const options of [{ limit: 0 }, { limit: 51 }, { limit: '5' }, { cursor: 'bad' }, { cursor: ['bad'] }, { cursor: '2026-01-01|aaaaaaaaaaaaaaaaaaaaaaaa|extra' }, { order: 'random' }]) {
    await assert.rejects(searchUserDiaries(Diary, owner, {}, options), error => error.status === 400);
  }
  for (const query of [{ range: {} }, { range: { start: '2026-02-31', end: now } }, { mood: { $ne: null } }, { terms: [{ $ne: null }] }, { place: { $regex: '.*' } }]) {
    await assert.rejects(getEmotionStatistics(Diary, owner, query), error => error.status === 400);
  }
  await assert.rejects(getAuthorizedDiaryDetails(Diary, owner, ['not-id']), error => error.status === 400);
});
integration('actual-location filtering is separate from mentions and regex metacharacters stay literal', async () => {
  assert.equal((await searchUserDiaries(Diary, places, { place: '臺北', asOf: now })).diaries.length, 1);
  assert.equal((await searchUserDiaries(Diary, places, { place: '臺北', placeMode: 'mentioned', asOf: now })).diaries.length, 1);
  const literal = await searchUserDiaries(Diary, places, { terms: ['.*'], asOf: now });
  assert.equal(literal.diaries.length, 1); assert.match(literal.diaries[0].content, /^\.\*/);
  const trip = planMemoryQuestion('幫我回顧在澳洲旅行期間的生活。', [], now);
  assert.equal((await searchUserDiaries(Diary, places, trip)).diaries[0].place, '澳洲墨爾本');
});
integration('Taipei boundaries distinguish December 31 from January 1 through the last millisecond', async () => {
  for (const [text, count] of [['回顧2025年12月31日的日記', 1], ['回顧2026年1月1日的日記', 2], ['回顧2025-12-31到2026-01-01的日記', 3], ['回顧去年日記', 1], ['回顧今年日記', 3]]) {
    assert.equal((await getEmotionStatistics(Diary, boundaries, planMemoryQuestion(text, [], now))).total, count, text);
  }
  assert.equal((await getEmotionStatistics(Diary, boundaries, { asOf: now, range: { start: '2026-01-01', end: '2026-01-02' } })).total, 2);
});
integration('full-range statistics and separate year comparisons are computed by MongoDB', async () => {
  const plan = planMemoryQuestion('去年跟今年的生活有什麼不同？', [], now);
  const stats = await getEmotionStatistics(Diary, owner, plan);
  assert.equal(stats.total, 50); assert.deepEqual(stats.comparisons.map(item => item.total), [10, 40]);
  assert.deepEqual(stats.comparisons.map(item => item.averageIntensity), [3, 3]);
  assert.equal(stats.averageIntensity, 3);
  for (const mood of stats.moods) assert.equal(mood.count, 10);
  assert.equal(stats.monthly.reduce((sum, item) => sum + item.count, 0), 50);
  assert.equal(stats.places[0].count, 50); assert.equal(stats.places[0].moods.reduce((sum, mood) => sum + mood.count, 0), 50);
  const separateYears = await getEmotionStatistics(Diary, owner, planMemoryQuestion('比較2024年與2026年的生活變化', [], now));
  assert.deepEqual(separateYears.comparisons.map(item => item.total), [0, 40]);
  assert.equal(separateYears.comparisons[0].averageIntensity, null);
  assert.equal(separateYears.status, 'INSUFFICIENT_EVIDENCE');
  assert.ok(separateYears.monthly.every(item => !item.month.startsWith('2025')), 'an excluded comparison interval must not be labelled missing records');
});
integration('empty accounts, unmatched ranges and sparse evidence remain distinct', async () => {
  assert.equal((await getEmotionStatistics(Diary, empty)).status, 'NO_DIARIES');
  assert.equal((await getEmotionStatistics(Diary, owner, planMemoryQuestion('回顧2020年的日記', [], now))).status, 'NO_MATCHES');
  assert.equal((await getEmotionStatistics(Diary, single)).status, 'INSUFFICIENT_EVIDENCE');
  const sparseStats = await getEmotionStatistics(Diary, sparse, planMemoryQuestion('最近半年的心情如何', [], now));
  assert.equal(sparseStats.monthly.find(item => item.month === '2026-08').count, 0);
  assert.equal(sparseStats.monthly.find(item => item.month === '2026-08').averageIntensity, null);
  assert.equal(sparseStats.monthly.find(item => item.month === '2026-08').evidenceStatus, 'NO_RECORDS');
  assert.equal(sparseStats.monthly.find(item => item.month === '2026-05').evidenceStatus, 'INSUFFICIENT_EVIDENCE');
});
integration('legacy invalid intensity values never become invented averages', async () => {
  const user = new mongoose.Types.ObjectId();
  await Diary.collection.insertMany([1, 5, null, 0, 9, '5'].map(intensity => ({ ...base(user), _id: new mongoose.Types.ObjectId(), mood: { type: 'calm', intensity } })));
  const stats = await getEmotionStatistics(Diary, user, { asOf: now });
  assert.equal(stats.total, 6); assert.equal(stats.moods[0].intensityCount, 2); assert.equal(stats.averageIntensity, 3);
});
integration('Insights and Memory Chat share exactly the same owned statistics for equal periods', async () => {
  const overview = await getIntelligenceOverview(Diary, owner, '90', now);
  const chat = await retrieveMemories(Diary, owner, planMemoryQuestion('最近90天的心情變化如何', [], now));
  assert.equal(chat.total, overview.count);
  assert.deepEqual(chat.moods.map(({ _id, count }) => ({ type: _id, count })), overview.moods);
  assert.equal(chat.placeCount, overview.placeCount);
});
integration('yearly life reviews include early evidence rather than just the latest forty candidates', async () => {
  const context = await retrieveMemories(Diary, owner, planMemoryQuestion('最近一年我的生活有什麼變化？', [], now));
  assert.equal(context.total, 50); assert.ok(context.diaries.some(item => item.id === String(owned[0]._id)));
  assert.ok(context.diaries.some(item => item.content.includes('開始準備')));
});
integration('source ids must exist, belong to this owner and be in the supplied evidence', async () => {
  const [source] = await getAuthorizedDiaryDetails(Diary, owner, [String(owned[0]._id)]);
  assert.equal((await validateDiaryCitations(Diary, owner, [source.id], [source]))[0].id, source.id);
  for (const ids of [[String(foreign[0]._id)], ['ffffffffffffffffffffffff'], ['invalid']]) {
    await assert.rejects(validateDiaryCitations(Diary, owner, ids, [source]), error => error.category === 'invalid_citation');
  }
});
integration('editing or deleting a source while generating invalidates the answer before it is returned', async () => {
  for (const change of ['edit', 'delete']) {
    const diary = await Diary.create(base(owner));
    try {
      await assert.rejects(answerMemoryQuestion({ message: `找出提到「${diary.title}」的日記`, userId: owner, Diary, now, reserve: async () => {},
        generate: async request => {
          const selected = request.data.diaries.find(item => item.id === String(diary._id));
          assert.ok(selected);
          if (change === 'edit') await Diary.updateOne({ _id: diary._id }, { $set: { text: '內容已經更改。' } });
          else await Diary.deleteOne({ _id: diary._id });
          return { answer: '這篇日記記錄了片段。[1]', citations: [request.data.diaries[0].id, selected.id] };
        } }), error => error.category === 'stale_evidence' && error.status === 409);
    } finally { await Diary.deleteOne({ _id: diary._id }); }
  }
});
integration('database failures are RETRIEVAL_ERROR, never a false empty state', async () => {
  const broken = { find() { throw new Error('database disconnected'); }, aggregate() { throw new Error('database disconnected'); } };
  for (const invoke of [() => getEmotionStatistics(broken, owner), () => searchUserDiaries(broken, owner), () => getAuthorizedDiaryDetails(broken, owner, [String(owned[0]._id)])]) {
    await assert.rejects(invoke(), error => error.category === 'retrieval' && error.status === 503);
  }
});
integration('a real MongoDB rejected query is classified as retrieval failure, never an empty account', async () => {
  const rejected = { aggregate: pipeline => Diary.aggregate([...pipeline, { $unknownRetrievalStage: {} }]) };
  await assert.rejects(getEmotionStatistics(rejected, owner), error => error.category === 'retrieval' && error.status === 503);
});
integration('generated Insights receives trusted statistics and cannot replace the numeric mean', async () => {
  const stats = await getEmotionStatistics(Diary, owner, { asOf: now });
  const { diaries } = await searchUserDiaries(Diary, owner, { asOf: now }, { limit: 40 });
  const insight = await generateLifeMapInsight(diaries, undefined, { statistics: stats, generate: async request => {
    assert.equal(request.data.statistics.averageIntensity, 3);
    assert.ok(request.data.diaries.every(item => item.id && item.source.revision));
    assert.ok(request.data.diaries.every(item => item.source.end - item.source.start === item.content.length));
    assert.equal(request.data.statistics.daily, undefined, 'unused daily facts do not inflate model input');
    return { summary: '生活回顧。', moodTrend: { description: '記錄片段。', dominantMood: 'calm', averageIntensity: 5 }, locationInsights: [], behaviorPatterns: [], suggestions: [] };
  } });
  assert.equal(insight.moodTrend.averageIntensity, 3);
});
integration('aggregation counts all 500 and 5000 records while evidence and pages remain bounded', async () => {
  for (const [user, count] of [[medium, 500], [large, 5000]]) {
    const stats = await getEmotionStatistics(Diary, user, { asOf: now });
    assert.equal(stats.total, count); assert.equal(stats.moods[0].count, count);
    const context = await retrieveMemories(Diary, user, planMemoryQuestion('回顧我最近半年的生活變化', [], now));
    assert.ok(context.diaries.length <= 16);
    assert.equal((await searchUserDiaries(Diary, user, { asOf: now })).diaries.length, 20);
  }
});
test('validated structured context preserves a topic after more than twelve elliptical turns', () => {
  let context = validateQueryContext(planMemoryQuestion('最近半年的生活有什麼變化？', [], now));
  for (let index = 0; index < 40; index++) context = validateQueryContext(planMemoryQuestion('再深入一點', [], now, JSON.parse(JSON.stringify(context))));
  assert.equal(context.intent, 'life_review'); assert.equal(context.range.start.toISOString(), '2026-04-30T04:00:00.000Z');
  assert.throws(() => validateQueryContext({ ...context, mood: { $ne: null } }), error => error.status === 400);
});

integration('JWT to real MongoDB to both AI endpoints uses only the authenticated owner, not supplied identities', async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-phase1-jwt-test-only';
  const user = await User.create({ _id: owner, name: 'Retrieval owner', email: 'retrieval@example.test', userCode: 'retrieval', passwordHash: 'fixture-only' });
  let server, baseUrl, calls = 0;
  try {
    const app = express(); app.use(express.json());
    app.use('/ai', createAiRouter({ reserve: async () => {}, generate: async ({ data, feature }) => {
      calls++;
      assert.ok(data.diaries.every(item => owned.some(diary => String(diary._id) === item.id)));
      assert.doesNotMatch(JSON.stringify(data), /OTHER ACCOUNT SECRET|passwordHash|coordinates/);
      assert.equal(feature === 'insights' ? data.statistics.total : data.evidence.matchedCount, 50);
      return feature === 'insights' ? { summary: '回顧真實片段。', moodTrend: { description: '記錄片段。', dominantMood: 'calm' }, locationInsights: [], behaviorPatterns: [], suggestions: [] }
        : { answer: '回顧真實片段。[1]', citations: [data.diaries[0].id] };
    } }));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/ai`;
    const token = jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1m' });
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const ask = extra => fetch(`${baseUrl}/chat`, { method: 'POST', headers, body: JSON.stringify({ message: '回顧我所有日記的生活經歷', ...extra }) });
    const insight = await fetch(`${baseUrl}/life-map?userId=${other}`, { headers });
    assert.equal(insight.status, 200); assert.equal((await insight.json()).data.statistics.total, 50);
    const chat = await ask({ userId: String(other), user: String(other), queryContext: { intent: 'life_review', topic: '生活經歷', depth: 'standard', user: String(other) } });
    assert.equal(chat.status, 200); assert.equal((await chat.json()).data.evidence.matchedCount, 50);
    for (const authorization of [undefined, 'Bearer broken', `Bearer ${jwt.sign({ sub: String(user._id) }, 'wrong-secret')}`,
      `Bearer ${jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: -1 })}`,
      `Bearer ${jwt.sign({ sub: String(new mongoose.Types.ObjectId()) }, process.env.JWT_SECRET)}`]) {
      assert.equal((await fetch(`${baseUrl}/life-map`, { headers: authorization ? { Authorization: authorization } : {} })).status, 401);
    }
    assert.equal(calls, 2, 'rejected JWTs never invoke the provider');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  }
});
