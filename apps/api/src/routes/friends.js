import express from 'express';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { notifySocialChange, notifyNotificationChange } from './diaries.js';
import { getFriendRecommendations } from '../services/friendRecommendationService.js';
import { cancelInvitation, createSocialLimiter, publicPerson, publicPersonFields, removeFriend, respondToInvitation, sendInvitation } from '../services/friendRelationships.js';
import { getPersonMemories, getSharedPlaces, getSocialProfile, searchPeople } from '../services/socialProfiles.js';

const router = express.Router();
const readLimit = createSocialLimiter(90), searchLimit = createSocialLimiter(30), writeLimit = createSocialLimiter(20);
router.use(requireAuth);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.get('/', readLimit, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('friends').populate('friends', publicPersonFields);
    res.json({ success: true, data: (user?.friends || []).filter(Boolean).map(publicPerson) });
  } catch (error) { next(error); }
});
router.get('/search', searchLimit, async (req, res, next) => {
  try { res.json({ success: true, data: await searchPeople(req.user, req.query.q) }); }
  catch (error) { next(error); }
});
router.get('/requests', readLimit, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('friendRequests friends').populate('friendRequests.from', publicPersonFields);
    const seen = new Set((user?.friends || []).map(String));
    const data = (user?.friendRequests || []).filter(item => {
      if (!item.from || item.status !== 'pending' || seen.has(String(item.from._id))) return false;
      seen.add(String(item.from._id)); return true;
    }).map(item => ({ requestId: item._id, from: publicPerson(item.from), createdAt: item.createdAt }));
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
router.get('/requests/sent', readLimit, async (req, res, next) => {
  try {
    const people = await User.find({ friendRequests: { $elemMatch: { from: req.user._id, status: 'pending' } } })
      .select(`${publicPersonFields} friendRequests`).lean();
    const data = people.flatMap(person => {
      if (req.user.friends.some(id => String(id) === String(person._id))) return [];
      const item = person.friendRequests.find(invite => invite.status === 'pending' && String(invite.from) === String(req.user._id));
      return item ? [{ requestId: item._id, to: publicPerson(person), createdAt: item.createdAt }] : [];
    });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
router.get('/recommendations', searchLimit, async (req, res, next) => {
  try { res.json({ success: true, data: await getFriendRecommendations(req.user._id, { limit: req.query.limit }) }); }
  catch (error) { next(error); }
});
router.get('/:friendId/profile', readLimit, async (req, res, next) => {
  try { res.json({ success: true, data: await getSocialProfile(req.user._id, req.params.friendId) }); }
  catch (error) { next(error); }
});
router.get('/:friendId/memories', readLimit, async (req, res, next) => {
  try { res.json({ success: true, data: await getPersonMemories(req.user._id, req.params.friendId, req.query.cursor) }); }
  catch (error) { next(error); }
});
router.get('/:friendId/places', readLimit, async (req, res, next) => {
  try { res.json({ success: true, data: await getSharedPlaces(req.user._id, req.params.friendId) }); }
  catch (error) { next(error); }
});

function mutation(action, message) {
  return async (req, res, next) => {
    try {
      const data = await action(req);
      notifySocialChange([req.user._id, data.targetUserId]);
      notifyNotificationChange([req.user._id, data.targetUserId]);
      res.json({ success: true, message: data.friendshipStatus === 'received_request' ? '對方已邀請你，可以直接接受邀請' : message, data });
    } catch (error) { next(error); }
  };
}
router.post('/request', writeLimit, mutation(req => sendInvitation(req.user._id, req.body.targetUserId), '好友邀請狀態已更新'));
router.delete('/requests/:requestId/cancel', writeLimit, mutation(req => cancelInvitation(req.user._id, req.params.requestId), '好友邀請已撤回'));
router.post('/requests/:requestId/accept', writeLimit, mutation(req => respondToInvitation(req.user._id, req.params.requestId, true), '已成為好友'));
router.post('/requests/:requestId/reject', writeLimit, mutation(req => respondToInvitation(req.user._id, req.params.requestId, false), '已拒絕好友邀請'));
router.delete('/:friendId', writeLimit, mutation(req => removeFriend(req.user._id, req.params.friendId), '已移除好友'));
export default router;
