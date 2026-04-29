import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const publicUserFields = '_id name avatar userCode';

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', publicUserFields)
      .select('friends');

    res.json({
      success: true,
      message: '取得好友列表成功',
      data: user?.friends || []
    });
  } catch (error) {
    next(error);
  }
});

router.post('/request', async (req, res, next) => {
  try {
    const { targetUserId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: '好友目標不正確'
      });
    }

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: '不能加自己為好友'
      });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.user._id),
      User.findById(targetUserId)
    ]);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '找不到此使用者'
      });
    }

    const targetId = targetUser._id.toString();
    const currentId = currentUser._id.toString();
    const alreadyFriends = currentUser.friends.some((friendId) => friendId.toString() === targetId);

    if (alreadyFriends) {
      return res.status(409).json({
        success: false,
        message: '你們已經是好友'
      });
    }

    const pendingSent = targetUser.friendRequests.some(
      (request) => request.from.toString() === currentId && request.status === 'pending'
    );

    if (pendingSent) {
      return res.status(409).json({
        success: false,
        message: '已送出好友邀請'
      });
    }

    const pendingReceived = currentUser.friendRequests.some(
      (request) => request.from.toString() === targetId && request.status === 'pending'
    );

    if (pendingReceived) {
      return res.status(409).json({
        success: false,
        message: '對方已經送出好友邀請，請到邀請列表接受'
      });
    }

    await User.updateOne(
      { _id: targetUser._id },
      { $push: { friendRequests: { from: currentUser._id } } }
    );

    res.status(201).json({
      success: true,
      message: '好友邀請已送出'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/requests', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friendRequests.from', publicUserFields)
      .select('friendRequests');

    const requests = (user?.friendRequests || [])
      .filter((request) => request.status === 'pending' && request.from)
      .map((request) => ({
        requestId: request._id,
        from: request.from,
        createdAt: request.createdAt
      }));

    res.json({
      success: true,
      message: '取得好友邀請成功',
      data: requests
    });
  } catch (error) {
    next(error);
  }
});

router.post('/requests/:requestId/accept', async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const request = currentUser.friendRequests.id(req.params.requestId);

    if (!request || request.status !== 'pending') {
      return res.status(404).json({
        success: false,
        message: '找不到好友邀請'
      });
    }

    const fromUser = await User.findById(request.from);

    if (!fromUser) {
      await User.updateOne(
        { _id: currentUser._id, 'friendRequests._id': request._id },
        { $set: { 'friendRequests.$.status': 'rejected' } }
      );

      return res.status(404).json({
        success: false,
        message: '找不到邀請者'
      });
    }

    await Promise.all([
      User.updateOne(
        { _id: currentUser._id, 'friendRequests._id': request._id },
        { $set: { 'friendRequests.$.status': 'accepted' } }
      ),
      User.updateOne({ _id: currentUser._id }, { $addToSet: { friends: fromUser._id } }),
      User.updateOne({ _id: fromUser._id }, { $addToSet: { friends: currentUser._id } })
    ]);

    res.json({
      success: true,
      message: '已成為好友'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/requests/:requestId/reject', async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const request = currentUser.friendRequests.id(req.params.requestId);

    if (!request || request.status !== 'pending') {
      return res.status(404).json({
        success: false,
        message: '找不到好友邀請'
      });
    }

    await User.updateOne(
      { _id: currentUser._id, 'friendRequests._id': request._id },
      { $set: { 'friendRequests.$.status': 'rejected' } }
    );

    res.json({
      success: true,
      message: '已拒絕好友邀請'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
