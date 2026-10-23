import User from '../models/User.js';
import { publicPerson } from './friendRelationships.js';

export function parseRecommendationLimit(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(20, parsed)) : 10;
}

export async function getFriendRecommendations(currentUserId, options = {}) {
  const current = await User.findById(currentUserId).select('friends friendRequests').lean();
  if (!current) return [];
  const friends = new Set(current.friends.map(String));
  const sent = await User.find({ friendRequests: { $elemMatch: { from: current._id, status: 'pending' } } }).select('_id').lean();
  const exclude = [current._id, ...current.friends, ...sent.map(person => person._id),
    ...current.friendRequests.filter(item => item.status === 'pending').map(item => item.from)];
  if (!friends.size) return [];
  const candidates = await User.find({ _id: { $nin: exclude }, friends: { $in: current.friends } })
    .select('_id name userCode avatar friends createdAt').sort({ name: 1, _id: 1 }).limit(200).maxTimeMS(5000).lean();
  return candidates.map(person => {
    const mutualFriendsCount = person.friends.filter(id => friends.has(String(id))).length;
    return { ...publicPerson(person), friendshipStatus: 'none', mutualFriendsCount,
      reasons: [`有 ${mutualFriendsCount} 位共同好友`] };
  }).sort((a, b) => b.mutualFriendsCount - a.mutualFriendsCount || String(a._id).localeCompare(String(b._id)))
    .slice(0, parseRecommendationLimit(options.limit));
}
