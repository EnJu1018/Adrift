import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Diary from '../src/models/Diary.js';
import friendsRouter from '../src/routes/friends.js';
import diariesRouter, { broadcastDiaryEvent } from '../src/routes/diaries.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { cancelInvitation, removeFriend, respondToInvitation, sendInvitation } from '../src/services/friendRelationships.js';
import { getFriendRecommendations } from '../src/services/friendRecommendationService.js';
import { sharedPlaces } from '../src/services/socialProfiles.js';

test('shared places exclude private, distant and invalid coordinates without exposing internal centers', () => {
  const diary = (id, visibility = 'public', coordinates = [120.5, 24.2], placeName = '河岸') => ({ _id: id, title: id, visibility, location: { coordinates, placeName } });
  const result = sharedPlaces([diary('mine'), diary('mine-private', 'private')], [
    diary('near'), diary('far', 'public', [121.5, 24.2]), diary('private', 'private'),
    diary('invalid', 'public', [400, 24.2]), diary('unnamed', 'public', [120.5, 24.2], '')
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].theirs.map(item => item._id), ['near']);
  assert.equal(result[0].mine._id, 'mine');
  assert.equal('center' in result[0], false);
});

const uri = process.env.SOCIAL_TEST_MONGO_URI;
const integration = (name, fn) => test(name, { skip: !uri }, fn);
let server, base, a, b, c, publicDiary, friendsDiary;
before(async () => {
  if (!uri) return;
  const url = new URL(uri);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/adrift_social_test_')) throw new Error('Social tests require an isolated local test database');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.dropDatabase();
  await User.init(); await Diary.init();
  [a, b, c] = await User.create(['river', 'harbor', 'meadow'].map((code, index) => ({ name: ['River', 'Harbor', 'Meadow'][index], email: `${code}@example.test`, userCode: code, passwordHash: 'fixture-only' })));
  process.env.JWT_SECRET = 'isolated-social-integration-secret';
  const app = express(); app.use(express.json()); app.use('/friends', friendsRouter); app.use('/diaries', diariesRouter); app.use(errorHandler);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (!uri) return;
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await mongoose.connection.dropDatabase(); await mongoose.disconnect();
});
const token = user => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '5m' });
async function call(path, user = a, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token(user)}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...(await response.json()) };
}

integration('JWT required; simultaneous and duplicate invitations create one pending relationship', async () => {
  assert.equal((await fetch(base + '/friends')).status, 401);
  await assert.rejects(sendInvitation(a._id, a._id), error => error.statusCode === 400);
  const results = await Promise.all(Array.from({ length: 10 }, (_, index) => index % 2 ? sendInvitation(a._id, b._id) : sendInvitation(b._id, a._id)));
  const users = await User.find({ _id: { $in: [a._id, b._id] } }).lean();
  assert.equal(users.flatMap(user => user.friendRequests).filter(item => item.status === 'pending').length, 1);
  assert.ok(results.every(item => ['sent_request', 'received_request'].includes(item.friendshipStatus)));
});
integration('only recipient can accept/reject and only sender can cancel', async () => {
  const users = await User.find({ _id: { $in: [a._id, b._id] } });
  const recipient = users.find(user => user.friendRequests.some(item => item.status === 'pending'));
  const request = recipient.friendRequests.find(item => item.status === 'pending');
  await assert.rejects(respondToInvitation(c._id, String(request._id), true), error => error.statusCode === 404);
  await assert.rejects(cancelInvitation(c._id, String(request._id)), error => error.statusCode === 404);
  const results = await Promise.allSettled([respondToInvitation(recipient._id, String(request._id), true), respondToInvitation(recipient._id, String(request._id), false)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const left = await User.findById(a._id), right = await User.findById(b._id);
  assert.equal(left.friends.some(id => String(id) === String(b._id)), right.friends.some(id => String(id) === String(a._id)));
  if (!left.friends.length) {
    const sent = await sendInvitation(a._id, b._id);
    await respondToInvitation(b._id, String(sent.requestId), true);
  }
});
integration('atomic rollback prevents one-sided friendship if the second write fails', async () => {
  const sent = await sendInvitation(a._id, c._id);
  const update = User.updateOne;
  User.updateOne = function(query, changes, options) {
    if (String(query._id) === String(a._id) && changes.$addToSet) throw new Error('injected second write failure');
    return update.call(this, query, changes, options);
  };
  try { await assert.rejects(respondToInvitation(c._id, String(sent.requestId), true), /second write/); }
  finally { User.updateOne = update; }
  const current = await User.findById(c._id);
  assert.equal(current.friends.length, 0);
  assert.equal(current.friendRequests.id(sent.requestId).status, 'pending');
  await cancelInvitation(a._id, String(sent.requestId));
});
integration('search is case-normalized, fuzzy, escaped and never exposes account fields', async () => {
  assert.equal((await call('/friends/request', a, 'POST', { targetUserId: [String(c._id)], userId: String(c._id) })).status, 400);
  const result = await call('/friends/search?q=%40HARBOR');
  assert.equal(result.status, 200);
  assert.equal(result.data[0].userCode, 'harbor');
  assert.equal(result.data[0].friendshipStatus, 'friend');
  assert.equal((await call('/friends/search?q=arb')).data[0].name, 'Harbor');
  assert.equal((await call('/friends/search?q=%2E%2A')).data.length, 0);
  assert.equal((await call('/friends/search?q=x')).status, 400);
  const text = JSON.stringify(result.data);
  for (const field of ['email', 'passwordHash', 'role', 'socialVersion', 'friendRequests']) assert.ok(!text.includes(`"${field}"`));
});
integration('simultaneous withdrawal and acceptance have one winner and remain symmetric', async () => {
  const sent = await sendInvitation(a._id, c._id);
  const results = await Promise.allSettled([cancelInvitation(a._id, String(sent.requestId)), respondToInvitation(c._id, String(sent.requestId), true)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const left = await User.findById(a._id), right = await User.findById(c._id);
  assert.equal(left.friends.some(id => String(id) === String(c._id)), right.friends.some(id => String(id) === String(a._id)));
  await removeFriend(a._id, c._id);
});
integration('profiles, pagination and shared places use only mutually visible records', async () => {
  const entry = { title: '河岸散步', text: '晴天記憶', mood: { type: 'calm', intensity: 3 }, location: { type: 'Point', placeName: '臺北河岸', coordinates: [121.53, 25.04] } };
  await Diary.create({ ...entry, user: a._id, visibility: 'friends' });
  publicDiary = await Diary.create({ ...entry, user: b._id, visibility: 'public' });
  friendsDiary = await Diary.create({ ...entry, user: b._id, visibility: 'friends' });
  await Diary.create({ ...entry, user: b._id, title: 'PRIVATE SECRET', visibility: 'private' });
  await Diary.create({ ...entry, user: a._id, title: 'PRIVATE LOCATION', visibility: 'private' });
  const profile = await call(`/friends/${b._id}/profile`);
  assert.deepEqual(profile.data.diaryStats, { publicCount: 1, friendsCount: 1 });
  assert.equal(profile.data.canViewSharedPlaces, true);
  const memories = await call(`/friends/${b._id}/memories`);
  assert.equal(memories.data.diaries.length, 2);
  const shared = await call(`/friends/${b._id}/places`);
  assert.equal(shared.data.places[0].place, '臺北河岸');
  assert.ok(!JSON.stringify(shared).includes('PRIVATE'));
  assert.equal((await call(`/friends/${b._id}/memories`, c)).data.diaries.length, 1);
  assert.equal((await call(`/friends/${b._id}/places`, c)).status, 403);
  assert.equal((await call(`/friends/${b._id}/memories?cursor=bad`)).status, 400);
  await Diary.insertMany(Array.from({ length: 15 }, (_, index) => ({ ...entry, user: b._id, title: `Page ${index}`, visibility: 'public' })));
  const first = await call(`/friends/${b._id}/memories`), second = await call(`/friends/${b._id}/memories?cursor=${first.data.nextCursor}`);
  assert.equal(first.data.diaries.length, 12);
  assert.ok(second.data.diaries.length > 0);
  assert.ok(!second.data.diaries.some(item => first.data.diaries.some(previous => previous._id === item._id)));
});
integration('recommendations are deterministic mutual-friend facts without Gemini or location', async () => {
  const sent = await sendInvitation(c._id, b._id); await respondToInvitation(b._id, String(sent.requestId), true);
  const result = await getFriendRecommendations(a._id);
  assert.equal(String(result[0]._id), String(c._id));
  assert.equal(result[0].mutualFriendsCount, 1);
  assert.ok(!JSON.stringify(result).includes('location'));
});
integration('removal immediately revokes HTTP and already-open event-stream access', async () => {
  const controller = new AbortController();
  const stream = await fetch(`${base}/diaries/events?token=${token(a)}`, { signal: controller.signal });
  const reader = stream.body.getReader(); await reader.read();
  assert.equal((await call(`/friends/${b._id}`, a, 'DELETE')).status, 200);
  assert.equal((await call(`/diaries/${friendsDiary._id}`)).status, 404);
  assert.equal((await call(`/friends/${b._id}/profile`)).data.canViewSharedPlaces, false);
  assert.equal((await call(`/friends/${b._id}/places`)).status, 403);
  await broadcastDiaryEvent('diary:created', friendsDiary);
  await broadcastDiaryEvent('diary:created', publicDiary);
  let text = ''; const decoder = new TextDecoder();
  while (!text.includes(String(publicDiary._id))) { const chunk = await reader.read(); if (chunk.done) break; text += decoder.decode(chunk.value); }
  assert.ok(text.includes('social:changed'));
  assert.ok(!text.includes(String(friendsDiary._id)), 'revoked friend-only diary must not enter an existing stream');
  controller.abort();
  await removeFriend(a._id, b._id);
});
integration('search and mutations are rate limited with Retry-After', async () => {
  for (let index = 0; index < 31; index++) {
    const response = await call('/friends/search?q=zz', c);
    if (index === 30) assert.equal(response.status, 429);
  }
  for (let index = 0; index < 21; index++) {
    const response = await fetch(base + '/friends/request', { method: 'POST', headers: { Authorization: `Bearer ${token(c)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUserId: String(c._id) }) });
    if (index === 20) { assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60'); }
    else assert.equal(response.status, 400);
    await response.json();
  }
});
