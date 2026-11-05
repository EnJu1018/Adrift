import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import mongoose from 'mongoose';
import Diary from '../src/models/Diary.js';
import { createMemoryAgent } from '../src/services/memoryAgent.js';
import { agentDiaryFixtures, agentNow } from './fixtures/agentDiaries.js';
const uri = process.env.AGENT_ORCHESTRATOR_TEST_MONGO_URI;
const integration = (name, fn) => test(name, { skip: !uri }, fn);
const [owner, other, paging] = Array.from({ length: 3 }, () => new mongoose.Types.ObjectId());
const req = { user: { _id: owner } };
let rows;
before(async () => {
  if (!uri) return;
  const url = new URL(uri); assert.equal(url.hostname, '127.0.0.1'); assert.match(url.pathname, /^\/adrift_agent_orchestrator_test_[a-z\d_-]+$/);
  await mongoose.connect(uri); await mongoose.connection.dropDatabase();
  const fixture = agentDiaryFixtures(owner, other, paging); rows = [...fixture.owned, ...fixture.foreign].map(row => ({ ...row, _id: new mongoose.Types.ObjectId() }));
  await Diary.collection.insertMany(rows);
});
after(async () => { if (uri && mongoose.connection.readyState === 1) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } });
const agent = provider => createMemoryAgent({ Diary, provider, now: () => agentNow });
const select = input => ({ json: { evidenceIds: JSON.parse(input.messages[1].content).diaries.map(row => row.id) }, metrics: { promptTokens: 200, outputTokens: 50 } });
integration('real multi-tool task returns exact statistics and owned, current quote evidence', async () => {
  const result = await agent({ chat: async input => select(input) }).run(req, { question: '深入分析最近半年心情變化' });
  assert.equal(result.state, 'COMPLETED'); assert.equal(result.claims[0].total, 4); assert.equal(result.usage.toolCalls, 4);
  assert.ok(result.sources.every(source => rows.slice(0, 9).some(row => String(row._id) === source.id)));
  assert.doesNotMatch(JSON.stringify(result), /FOREIGN ACCOUNT/);
});
integration('cross-year comparison has correct separate counts with five or fewer tools', async () => {
  const result = await agent().run(req, { question: '去年跟今年的我有什麼不同？' });
  assert.equal(result.state, 'COMPLETED'); assert.deepEqual(result.claims.filter(row => row.kind === 'statistics').map(row => row.total), [1, 8]);
  assert.ok(result.usage.toolCalls <= 5);
});
integration('four multi-turn changes retain time, place and intent without leaking the other account', async () => {
  const service = agent(); let conversationId;
  const totals = [];
  for (const question of ['分析最近一個月心情', '改成半年', '那臺中呢？', '那去年呢？']) {
    const result = await service.run(req, { question, conversationId }); conversationId = result.conversationId;
    totals.push(result.claims[0]?.total);
  }
  assert.deepEqual(totals, [2, 4, 1, 0]);
});
integration('source edits during inference invalidate the final answer', async () => {
  const service = agent({ chat: async input => {
    const response = select(input); await Diary.updateOne({ _id: response.json.evidenceIds[0] }, { $set: { text: '已修改的內容' } }); return response;
  } });
  const result = await service.run(req, { question: '分析最近半年心情' });
  assert.equal(result.state, 'FAILED'); assert.deepEqual(result.sources, []);
  assert.ok(result.trace.some(event => event.category === 'stale_evidence'));
});
integration('city counts use stored place names, not diary text or the latest search sample', async () => {
  const result = await agent().run(req, { question: '我在哪個城市留下最多開心的回憶？' });
  assert.equal(result.state, 'COMPLETED');
  const cities = result.claims[0].cities;
  assert.equal(cities.cities[0].city, '臺北'); assert.equal(cities.cities[0].count, 3);
  assert.equal(cities.unclassifiedCount, 0);
});
