import mongoose from 'mongoose';
import User from '../models/User.js';
import { createNotification } from './notifications.js';

export const publicPersonFields = '_id name avatar userCode createdAt';
const same = (a, b) => String(a?._id || a) === String(b?._id || b);
const pendingFrom = (user, id) => user.friendRequests?.find(item => item.status === 'pending' && same(item.from, id));
export function socialError(message, statusCode = 409) { return Object.assign(new Error(message), { statusCode }); }
export function validPersonId(id) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw socialError('使用者 ID 不正確', 400);
  return new mongoose.Types.ObjectId(id);
}
export function publicPerson(user) {
  return { _id: user._id, name: user.name, avatar: user.avatar || '', userCode: user.userCode || '', createdAt: user.createdAt };
}
export function relationship(current, target) {
  if (same(current, target)) return { friendshipStatus: 'self' };
  if (current.friends?.some(id => same(id, target))) return { friendshipStatus: 'friend' };
  const received = pendingFrom(current, target._id), sent = pendingFrom(target, current._id);
  if (received) return { friendshipStatus: 'received_request', requestId: received._id };
  if (sent) return { friendshipStatus: 'sent_request', requestId: sent._id };
  return { friendshipStatus: 'none' };
}

async function changePair(viewerId, targetId, change) {
  validPersonId(String(targetId));
  if (same(viewerId, targetId)) throw socialError('不能對自己進行好友操作', 400);
  try {
    return await User.db.transaction(async session => {
      // Every operation on a pair locks the same document before reading either side.
      const lockId = [String(viewerId), String(targetId)].sort()[0];
      const locked = await User.updateOne({ _id: lockId }, { $inc: { socialVersion: 1 } }, { session });
      if (!locked.matchedCount) throw socialError('找不到此使用者', 404);
      const current = await User.findById(viewerId).select('friends friendRequests').session(session);
      const target = await User.findById(targetId).select('friends friendRequests').session(session);
      if (!current || !target) throw socialError('找不到此使用者', 404);
      return change(current, target, session);
    }, { readPreference: 'primary', maxCommitTimeMS: 5000, timeoutMS: 15000 });
  } catch (error) {
    if (error.code === 20 || /transaction numbers|replica set/i.test(error.message)) throw socialError('好友服務需要支援交易的資料庫，請稍後再試', 503);
    throw error;
  }
}

export function sendInvitation(viewerId, targetId) {
  if (typeof targetId !== 'string' && !(targetId instanceof mongoose.Types.ObjectId)) throw socialError('使用者 ID 不正確', 400);
  return changePair(viewerId, targetId, async (current, target, session) => {
    const state = relationship(current, target);
    if (state.friendshipStatus !== 'none') return { ...state, targetUserId: target._id };
    if (target.friends.some(id => same(id, current))) throw socialError('好友狀態已變更，請重新整理');
    const invite = { _id: new mongoose.Types.ObjectId(), from: current._id, status: 'pending', createdAt: new Date() };
    await User.updateOne({ _id: target._id }, { $push: { friendRequests: invite } }, { session });
    await createNotification(target._id, current._id, 'friend_request', invite._id, session);
    return { friendshipStatus: 'sent_request', requestId: invite._id, targetUserId: target._id };
  });
}

export async function respondToInvitation(viewerId, requestId, accept) {
  validPersonId(requestId);
  const owner = await User.findById(viewerId).select('friendRequests').lean();
  const request = owner?.friendRequests?.find(item => same(item._id, requestId));
  if (!request) throw socialError('邀請已撤回或不存在', 404);
  return changePair(viewerId, request.from, async (current, target, session) => {
    const latest = current.friendRequests.find(item => same(item._id, requestId));
    if (!latest || latest.status !== 'pending') throw socialError('邀請已處理或撤回，已更新最新狀態');
    const update = { $set: { 'friendRequests.$[invite].status': accept ? 'accepted' : 'rejected' } };
    if (accept) update.$addToSet = { friends: target._id };
    await User.updateOne({ _id: current._id }, update, { session, arrayFilters: [{ 'invite.from': target._id, 'invite.status': 'pending' }] });
    if (accept) await User.updateOne({ _id: target._id }, {
      $addToSet: { friends: current._id }, $pull: { friendRequests: { from: current._id, status: 'pending' } }
    }, { session });
    if (accept) await createNotification(target._id, current._id, 'friend_accepted', request._id, session);
    return { friendshipStatus: accept ? 'friend' : 'none', targetUserId: target._id };
  });
}

export async function cancelInvitation(viewerId, requestId) {
  validPersonId(requestId);
  const receiver = await User.findOne({ friendRequests: { $elemMatch: { _id: requestId, from: viewerId, status: 'pending' } } }).select('_id').lean();
  if (!receiver) throw socialError('邀請已處理、撤回或不存在', 404);
  return changePair(viewerId, receiver._id, async (current, target, session) => {
    if (!target.friendRequests.some(item => same(item._id, requestId) && same(item.from, current) && item.status === 'pending')) throw socialError('邀請狀態已變更');
    await User.updateOne({ _id: target._id }, { $pull: { friendRequests: { from: current._id, status: 'pending' } } }, { session });
    return { friendshipStatus: 'none', targetUserId: target._id };
  });
}

export function removeFriend(viewerId, targetId) {
  return changePair(viewerId, targetId, async (current, target, session) => {
    await User.updateOne({ _id: current._id }, { $pull: { friends: target._id, friendRequests: { from: target._id, status: 'pending' } } }, { session });
    await User.updateOne({ _id: target._id }, { $pull: { friends: current._id, friendRequests: { from: current._id, status: 'pending' } } }, { session });
    return { friendshipStatus: 'none', friendId: target._id, targetUserId: target._id };
  });
}

export function createSocialLimiter(limit) {
  const windows = new Map();
  return (req, res, next) => {
    const now = Date.now(), key = String(req.user._id);
    for (const [id, value] of windows) if (value.until <= now) windows.delete(id);
    const window = windows.get(key) || { count: 0, until: now + 60000 };
    if (window.count >= limit || windows.size >= 10000 && !windows.has(key)) return res.set('Retry-After', '60').status(429).json({ success: false, message: '操作太頻繁，請稍後再試。' });
    window.count++;
    windows.set(key, window);
    next();
  };
}
