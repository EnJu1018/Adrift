import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Diary from '../src/models/Diary.js';
import Notification from '../src/models/Notification.js';
import ModerationAction from '../src/models/ModerationAction.js';
import friends from '../src/routes/friends.js';
import diaries from '../src/routes/diaries.js';
import notifications from '../src/routes/notifications.js';
import admin from '../src/routes/admin.js';
import users from '../src/routes/users.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { spawnSync } from 'node:child_process';

const uri = process.env.NOTIFICATIONS_TEST_MONGO_URI;
const integration = (name, fn) => test(name, { skip: !uri }, fn);
let server, base, a, b, outsider, owner, administrator, diary, requestId;
before(async () => {
  if (!uri) return;
  const url = new URL(uri);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/adrift_notifications_test_')) throw new Error('Requires an isolated local test database');
  await mongoose.connect(uri); await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Diary.init(), Notification.init(), ModerationAction.init()]);
  const passwordHash = await bcrypt.hash('test-password', 4);
  [a, b, outsider, owner, administrator] = await User.create(['river', 'harbor', 'other', 'owner', 'admin'].map(code => ({ name: code, email: `${code}@example.test`, userCode: code, role: code === 'owner' ? 'owner' : code === 'admin' ? 'admin' : 'user', passwordHash })));
  diary = await Diary.create({ user: a._id, title: '河邊記憶', text: '不可放入通知的私人文字', visibility: 'public', mood: { type: 'calm', intensity: 3 }, location: { type: 'Point', coordinates: [120.5, 24.2], placeName: '河岸' } });
  process.env.JWT_SECRET = 'isolated-notification-test-secret';
  const app = express(); app.use(express.json()); app.use('/friends', friends); app.use('/diaries', diaries); app.use('/notifications', notifications); app.use('/admin', admin); app.use('/users', users); app.use(errorHandler);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (!uri) return; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
async function call(path, user = a, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '5m' })}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...(await response.json()) };
}
integration('authenticated invitation produces exactly one owned notification, scoped SSE and no private content', async () => {
  assert.equal((await fetch(base + '/notifications')).status, 401);
  const controller = new AbortController();
  const response = await fetch(`${base}/diaries/events?token=${jwt.sign({ sub: String(b._id) }, process.env.JWT_SECRET, { expiresIn: '5m' })}`, { signal: controller.signal });
  const reader = response.body.getReader(); await reader.read();
  try {
    const results = await Promise.all([call('/friends/request', a, 'POST', { targetUserId: String(b._id) }), call('/friends/request', a, 'POST', { targetUserId: String(b._id) })]);
    assert.ok(results.every(result => result.status === 200)); requestId = results[0].data.requestId;
    let events = ''; const deadline = setTimeout(() => controller.abort(), 3000);
    try { while (!events.includes('notifications:changed')) events += new TextDecoder().decode((await reader.read()).value); } finally { clearTimeout(deadline); }
    const inbox = await call('/notifications', b);
    assert.equal(inbox.data.unreadCount, 1); assert.equal(inbox.data.items.length, 1); assert.equal(inbox.data.items[0].actor.name, a.name);
    assert.equal(inbox.data.items[0].type, 'friend_request');
    assert.ok(!JSON.stringify(inbox).match(/passwordHash|email|不可放入|role/));
    assert.equal((await call('/notifications', outsider)).data.items.length, 0);
  } finally { controller.abort(); }
});
integration('acceptance, owned read persistence, read-all, target permissions and malformed ids', async () => {
  assert.equal((await call(`/friends/requests/${requestId}/accept`, b, 'POST')).status, 200);
  const inbox = (await call('/notifications', a)).data;
  assert.equal(inbox.items[0].type, 'friend_accepted');
  const id = inbox.items[0]._id;
  assert.equal((await call(`/notifications/${id}/read`, outsider, 'PATCH')).status, 404);
  assert.equal((await call(`/notifications/${id}/target`, outsider)).status, 404);
  assert.equal((await call(`/notifications/${id}/target`, a)).data.actorId, String(b._id));
  assert.equal((await call(`/notifications/${id}/read`, a, 'PATCH')).status, 200);
  assert.equal((await call('/notifications', a)).data.unreadCount, 0);
  assert.ok((await call('/notifications', a)).data.items[0].readAt);
  assert.equal((await call('/notifications/read-all', b, 'PATCH')).status, 200);
  assert.equal((await call('/notifications', b)).data.unreadCount, 0);
  assert.equal((await call('/notifications/bad/read', b, 'PATCH')).status, 400);
});
integration('reaction toggles do not spam; own reactions do not notify; deleted or private targets fail closed', async () => {
  for (const type of ['hug', 'hug', 'relate', 'understand']) assert.equal((await call(`/diaries/${diary._id}/react`, b, 'POST', { type })).status, 200);
  assert.equal((await call(`/diaries/${diary._id}/react`, a, 'POST', { type: 'hug' })).status, 200);
  const reaction = (await call('/notifications', a)).data.items.find(item => item.type === 'diary_reaction');
  assert.equal(await Notification.countDocuments({ type: 'diary_reaction' }), 1);
  await call(`/notifications/${reaction._id}/read`, a, 'PATCH');
  await call(`/diaries/${diary._id}/react`, b, 'POST', { type: 'hug' });
  assert.equal((await call('/notifications', a)).data.unreadCount, 0);
  assert.equal((await call(`/notifications/${reaction._id}/target`, a)).status, 200);
  await Diary.updateOne({ _id: diary._id }, { $set: { visibility: 'private' } });
  assert.equal((await call(`/diaries/${diary._id}/react`, outsider, 'POST', { type: 'hug' })).status, 404);
  await Diary.deleteOne({ _id: diary._id });
  assert.equal((await call(`/notifications/${reaction._id}/target`, a)).status, 404);
});
integration('feed cursor pagination includes friend public posts, excludes private and is unrelated to map radius', async () => {
  const input = Array.from({ length: 25 }, (_, index) => ({ user: b._id, title: `記憶 ${index}`, text: '公開生活', visibility: 'public', mood: { type: 'calm', intensity: 3 }, createdAt: new Date(1700000000000 + index), location: { type: 'Point', coordinates: [120.5, 24.2] } }));
  await Diary.insertMany([...input, { ...input[0], title: '私密', visibility: 'private' }, { ...input[0], title: '好友', visibility: 'friends' }]);
  const first = (await call('/diaries/feed?filter=friends', a)).data;
  assert.equal(first.diaries.length, 20); assert.ok(first.nextCursor);
  const second = (await call(`/diaries/feed?filter=friends&cursor=${encodeURIComponent(first.nextCursor)}`, a)).data;
  assert.equal(second.diaries.length, 6); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.diaries, ...second.diaries].map(item => item._id)).size, 26);
  assert.ok(![...first.diaries, ...second.diaries].some(item => item.title === '私密'));
  assert.equal((await call('/diaries/feed?filter=friends', outsider)).data.diaries.length, 0);
  assert.equal((await call('/diaries/feed?cursor=broken', a)).status, 400);
});
integration('admin authorization, owner protection, confirmed moderation audit and real status', async () => {
  assert.equal((await call('/admin/stats', a)).status, 403);
  assert.equal((await call(`/admin/users/${b._id}/role`, administrator, 'PATCH', { role: 'admin' })).status, 403);
  const secondOwner = await User.create({ name: 'Protected', email: 'protected@example.test', userCode: 'protected', role: 'owner', passwordHash: 'fixture-only' });
  assert.equal((await call(`/admin/users/${secondOwner._id}/role`, owner, 'PATCH', { role: 'user' })).status, 403);
  assert.equal((await call(`/admin/users/${secondOwner._id}`, owner, 'DELETE')).status, 403);
  const target = await Diary.findOne({ user: b._id });
  assert.equal((await call(`/admin/diaries/${target._id}`, administrator, 'DELETE')).status, 400);
  assert.equal((await call(`/admin/diaries/${target._id}`, administrator, 'DELETE', { reason: '測試違規內容移除' })).status, 200);
  assert.equal(await ModerationAction.countDocuments({ targetId: target._id, actor: administrator._id }), 1);
  assert.equal((await call('/admin/status', owner)).data.database.status, 'connected');
  assert.ok((await call('/admin/stats', owner)).data.recentUsers.length);
});

integration('changing a public diary to private revokes open SSE caches and target access', async () => {
  const memory = await Diary.create({ user: b._id, title: '收回分享', text: '只留給自己', visibility: 'public', mood: { type: 'calm', intensity: 2 }, location: { type: 'Point', coordinates: [120.5, 24.2] } });
  const controller = new AbortController();
  const response = await fetch(`${base}/diaries/events?token=${jwt.sign({ sub: String(outsider._id) }, process.env.JWT_SECRET, { expiresIn: '5m' })}`, { signal: controller.signal });
  const reader = response.body.getReader(); await reader.read();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    assert.equal((await call(`/diaries/${memory._id}`, b, 'PATCH', { title: '收回分享', content: '只留給自己', moodType: 'calm', moodIntensity: 2, visibility: 'private', currentLocation: { lng: 120.5, lat: 24.2 } })).status, 200);
    let events = '';
    while (!events.includes(String(memory._id))) events += new TextDecoder().decode((await reader.read()).value);
    assert.ok(events.includes(String(memory._id))); assert.ok(!events.includes('只留給自己'));
    const stale = await Notification.create({ recipient: outsider._id, actor: b._id, type: 'diary_reaction', targetId: memory._id });
    assert.equal((await call(`/notifications/${stale._id}/target`, outsider)).status, 404);
    await stale.deleteOne();
    assert.equal((await call(`/diaries/${memory._id}`, outsider)).status, 404);
  } finally { clearTimeout(timer); controller.abort(); }
});
integration('incorrect current password keeps session; account deletion cleans relationships, reactions and notifications', async () => {
  assert.equal((await call('/users/me/email', a, 'PATCH', { email: 'new@example.test', password: 'wrong' })).status, 400);
  assert.equal((await call('/users/me/password', a, 'PATCH', { currentPassword: 'wrong', newPassword: 'long-password', confirmPassword: 'long-password' })).status, 400);
  assert.equal((await call('/users/me', a)).status, 200);
  const target = await Diary.findOne({ user: b._id, visibility: 'public' });
  await call(`/diaries/${target._id}/react`, a, 'POST', { type: 'hug' });
  assert.equal((await call('/users/me', a, 'DELETE', { password: 'test-password', confirmText: 'DELETE' })).status, 200);
  assert.equal(await Notification.countDocuments({ $or: [{ actor: a._id }, { recipient: a._id }] }), 0);
  assert.equal(await Diary.countDocuments({ 'reactedUsers.userId': a._id }), 0);
  assert.equal((await User.findById(b._id)).friends.some(id => String(id) === String(a._id)), false);
  assert.equal((await call('/users/me', a)).status, 401);
});

integration('notification pagination is bounded, complete and ignores a caller-supplied recipient', async () => {
  await Notification.insertMany(Array.from({ length: 25 }, (_, index) => ({ recipient: outsider._id, actor: b._id, type: 'friend_request', targetId: new mongoose.Types.ObjectId(), createdAt: new Date(1700000000000 + index) })));
  const first = (await call(`/notifications?recipient=${owner._id}`, outsider)).data;
  assert.equal(first.items.length, 20); assert.equal(first.unreadCount, 25); assert.ok(first.nextCursor);
  const second = (await call(`/notifications?cursor=${encodeURIComponent(first.nextCursor)}`, outsider)).data;
  assert.equal(second.items.length, 5); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.items, ...second.items].map(item => item._id)).size, 25);
  await call('/notifications/read-all', outsider, 'PATCH');
  assert.equal((await call('/notifications', outsider)).data.unreadCount, 0);
});

integration('pending-invitation migration is idempotent and preserves read state', async () => {
  const legacy = await User.create({ name: 'Legacy', email: 'legacy@example.test', userCode: 'legacy', passwordHash: 'fixture-only', friendRequests: [{ from: b._id }, { from: b._id }] });
  const run = () => spawnSync(process.execPath, ['scripts/backfill-notifications.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, MONGODB_URI: uri, MONGO_URI: uri, NODE_ENV: 'test' }, encoding: 'utf8' });
  const first = run(); assert.equal(first.status, 0, first.stderr);
  assert.equal(await Notification.countDocuments({ recipient: legacy._id }), 1);
  const notification = await Notification.findOne({ recipient: legacy._id });
  notification.readAt = new Date(); await notification.save();
  const second = run(); assert.equal(second.status, 0, second.stderr);
  assert.equal(await Notification.countDocuments({ recipient: legacy._id }), 1);
  assert.equal((await Notification.findById(notification._id)).readAt.getTime(), notification.readAt.getTime());
  await legacy.deleteOne(); await notification.deleteOne();
});

integration('avatar rejects SVG and forged image content without changing current avatar', async () => {
  for (const mime of ['image/svg+xml', 'image/png']) {
    const body = new FormData(); body.append('avatar', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: mime }), 'fake.png');
    const response = await fetch(base + '/users/me/avatar', { method: 'PATCH', headers: { Authorization: `Bearer ${jwt.sign({ sub: String(outsider._id) }, process.env.JWT_SECRET)}` }, body });
    assert.equal(response.status, 400);
    assert.equal((await User.findById(outsider._id)).avatar, '');
  }
});
