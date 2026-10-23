import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Diary from '../src/models/Diary.js';
import User from '../src/models/User.js';
import { createAiRouter } from '../src/routes/ai.js';
import { getIntelligenceOverview } from '../src/services/intelligenceOverview.js';

const uri = process.env.INTELLIGENCE_TEST_MONGO_URI;
let server, base, owner, other;
const now = new Date();
before(async () => {
  if (!uri) return;
  const url = new URL(uri);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/adrift_intelligence_test_')) throw new Error('Overview tests require an isolated loopback test database');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.dropDatabase();
  [owner, other] = await User.create(['owner', 'other'].map(code => ({ name: code, email: `${code}@example.test`, userCode: code, passwordHash: 'fixture-only' })));
  const diary = (user, type, intensity, age, placeName) => ({ user, title: 'Memory', text: 'Local test', mood: { type, intensity }, location: { type: 'Point', coordinates: [120, 24], placeName }, visibility: 'private', createdAt: new Date(now.getTime() - age * 86400000) });
  await Diary.create([diary(owner._id, 'calm', 2, 1, '河岸'), diary(owner._id, 'joy', 4, 2, '河岸'), diary(owner._id, 'confused', 3, 45, '學校'), diary(owner._id, 'sad', 1, 100, '過去'), diary(other._id, 'anxious', 5, 1, '別人的地點')]);
  process.env.JWT_SECRET = 'isolated-overview-test-secret';
  const app = express(); app.use('/ai', createAiRouter({ reserve: () => { throw new Error('Read-only overview must not consume model quota'); } }));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}/ai/overview`;
});
after(async () => {
  if (!uri) return;
  await new Promise(resolve => server.close(resolve));
  await mongoose.connection.dropDatabase(); await mongoose.disconnect();
});
test('overview validates ranges before querying', async () => {
  for (const value of ['1', '365', { $ne: null }, ['30']]) await assert.rejects(getIntelligenceOverview({ aggregate: () => { throw new Error('must not query'); } }, 'id', value), error => error.status === 400);
});
test('real aggregation counts only owned records and the requested period', { skip: !uri }, async () => {
  const result = await getIntelligenceOverview(Diary, owner._id, '30', now);
  assert.equal(result.count, 2); assert.equal(result.placeCount, 1); assert.equal(result.places[0].count, 2);
  assert.equal(result.moods.reduce((sum, mood) => sum + mood.count, 0), 2);
  assert.equal(result.daily.reduce((sum, day) => sum + day.count, 0), 2);
  assert.equal(JSON.stringify(result).includes('別人'), false);
  assert.equal((await getIntelligenceOverview(Diary, owner._id, '90', now)).count, 3);
});
test('overview requires JWT, ignores supplied identities and does not reserve model quota', { skip: !uri }, async () => {
  assert.equal((await fetch(base)).status, 401);
  const headers = { Authorization: `Bearer ${jwt.sign({ sub: String(owner._id) }, process.env.JWT_SECRET)}` };
  const response = await fetch(`${base}?days=30&userId=${other._id}`, { headers });
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).data.count, 2);
  assert.equal((await fetch(`${base}?days[]=30`, { headers })).status, 400);
  for (let index = 0; index < 7; index++) assert.equal((await fetch(base, { headers })).status, 200);
});
test('statistics have a separate per-user read limit', { skip: !uri }, async () => {
  const headers = { Authorization: `Bearer ${jwt.sign({ sub: String(other._id) }, process.env.JWT_SECRET)}` };
  for (let index = 0; index < 61; index++) {
    const response = await fetch(base, { headers });
    assert.equal(response.status, index === 60 ? 429 : 200);
    if (index === 60) assert.equal(response.headers.get('Retry-After'), '60');
    await response.json();
  }
});
