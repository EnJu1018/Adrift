import Diary from '../models/Diary.js';
import User from '../models/User.js';
import { getDistanceInMeters } from '../utils/distance.js';
import { normalizeTaiwanPlaceName } from '../utils/locationFormatter.js';
import { publicPerson, publicPersonFields, relationship, socialError, validPersonId } from './friendRelationships.js';

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export async function searchPeople(viewer, value) {
  if (typeof value !== 'string') throw socialError('請輸入名稱或使用者 ID', 400);
  const query = value.normalize('NFKC').trim().replace(/^@/, '').toLowerCase();
  if (query.length < 2 || query.length > 40) throw socialError('請輸入 2～40 字的名稱或使用者 ID', 400);
  const people = await User.aggregate([
    { $match: { _id: { $ne: viewer._id }, $or: [{ userCode: { $regex: `^${escape(query)}`, $options: 'i' } }, { name: { $regex: escape(query), $options: 'i' } }] } },
    { $addFields: { exact: { $cond: [{ $eq: ['$userCode', query] }, 1, 0] } } },
    { $sort: { exact: -1, name: 1, _id: 1 } }, { $limit: 20 },
    { $project: { name: 1, avatar: 1, userCode: 1, createdAt: 1, friendRequests: 1, friends: 1 } }
  ]).option({ maxTimeMS: 5000 });
  return people.map(person => ({ ...publicPerson(person), ...relationship(viewer, person) }));
}

export async function getProfilePeople(viewerId, targetId) {
  validPersonId(targetId);
  const current = await User.findById(viewerId).select('friends friendRequests').lean();
  const target = await User.findById(targetId).select(`${publicPersonFields} friends friendRequests`).lean();
  if (!current || !target) throw socialError('找不到此使用者', 404);
  const state = relationship(current, target);
  const mutual = state.friendshipStatus === 'friend' && target.friends.some(id => String(id) === String(current._id));
  return { current, target, state, mutual };
}

export async function getSocialProfile(viewerId, targetId) {
  const { target, state, mutual } = await getProfilePeople(viewerId, targetId);
  const counts = await Diary.aggregate([
    { $match: { user: target._id, visibility: { $in: mutual ? ['public', 'friends'] : ['public'] } } },
    { $group: { _id: '$visibility', count: { $sum: 1 } } }
  ]).option({ maxTimeMS: 5000 });
  return { ...publicPerson(target), ...state, diaryStats: {
    publicCount: counts.find(item => item._id === 'public')?.count || 0,
    friendsCount: mutual ? counts.find(item => item._id === 'friends')?.count || 0 : 0
  }, canViewSharedPlaces: mutual };
}

export async function getPersonMemories(viewerId, targetId, cursor) {
  const { target, mutual } = await getProfilePeople(viewerId, targetId);
  const match = { user: target._id, visibility: { $in: mutual ? ['public', 'friends'] : ['public'] } };
  if (cursor) {
    try {
      if (typeof cursor !== 'string' || cursor.length > 200) throw new Error();
      const { date, id } = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      validPersonId(id);
      if (!Number.isFinite(Date.parse(date))) throw new Error();
      match.$or = [{ createdAt: { $lt: new Date(date) } }, { createdAt: new Date(date), _id: { $lt: id } }];
    } catch { throw socialError('分頁資訊不正確，請重新開啟個人資料', 400); }
  }
  const diaries = await Diary.find(match).select('title text mood location imageUrl visibility createdAt')
    .sort({ createdAt: -1, _id: -1 }).limit(13).maxTimeMS(5000).lean();
  const page = diaries.slice(0, 12), last = page.at(-1);
  return { diaries: page.map(diary => ({ ...diary, text: String(diary.text || '').slice(0, 240) })),
    nextCursor: diaries.length > 12 ? Buffer.from(JSON.stringify({ date: last.createdAt, id: last._id })).toString('base64url') : null };
}

export function sharedPlaces(mine, theirs) {
  const result = new Map();
  for (const left of mine) for (const right of theirs) {
    if (!['public', 'friends'].includes(left.visibility) || !['public', 'friends'].includes(right.visibility)) continue;
    const name = normalizeTaiwanPlaceName(left.location?.placeName || '').trim();
    if (!name || name !== normalizeTaiwanPlaceName(right.location?.placeName || '').trim()) continue;
    const a = left.location?.coordinates, b = right.location?.coordinates;
    if (![a, b].every(coords => Array.isArray(coords) && coords.length === 2 && coords.every(Number.isFinite) && Math.abs(coords[0]) <= 180 && Math.abs(coords[1]) <= 90)
      || getDistanceInMeters(a[1], a[0], b[1], b[0]) > 100) continue;
    const existing = [...result.entries()].find(([, entry]) => entry.place === name && getDistanceInMeters(a[1], a[0], entry.center[1], entry.center[0]) <= 100);
    const key = existing?.[0] || String(left._id);
    const entry = result.get(key) || { place: name, center: a, mine: { _id: left._id, title: left.title, createdAt: left.createdAt }, theirs: [] };
    if (entry.theirs.length < 8 && !entry.theirs.some(diary => String(diary._id) === String(right._id))) entry.theirs.push({ _id: right._id, title: right.title, createdAt: right.createdAt });
    result.set(key, entry);
  }
  return [...result.values()].slice(0, 12).map(({ center, ...entry }) => entry);
}

export async function getSharedPlaces(viewerId, targetId) {
  const { current, target, mutual } = await getProfilePeople(viewerId, targetId);
  if (!mutual) throw socialError('共同地點只提供給目前的好友查看', 403);
  const read = user => Diary.find({ user, visibility: { $in: ['public', 'friends'] } })
    .select('title createdAt location visibility').sort({ createdAt: -1, _id: -1 }).limit(100).maxTimeMS(5000).lean();
  const mine = await read(current._id), theirs = await read(target._id);
  return { places: sharedPlaces(mine, theirs), sampledPerPerson: 100,
    description: '比對雙方最近各 100 篇已分享日記；名稱一致且相距 100 公尺內，最多 12 個地點、各 8 篇好友記憶。不代表你們曾一起到訪。' };
}
