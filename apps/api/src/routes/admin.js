import express from 'express';
import { ROLES, VISIBILITIES } from '../constants/app.js';
import Diary from '../models/Diary.js';
import User from '../models/User.js';
import { requireAdminOrOwner, requireAuth, requireOwner } from '../middleware/auth.js';

const router = express.Router();
const adminUserFields = '_id name email userCode role avatar createdAt';
const adminDiaryUserFields = '_id name userCode avatar';

router.use(requireAuth);

function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requestedLimit = Number.parseInt(query.limit, 10) || 20;
  const limit = Math.min(Math.max(requestedLimit, 1), 50);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializeAdminUser(user) {
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    userCode: user.userCode || '',
    email: user.email,
    role: user.role || 'user',
    avatar: user.avatar || '',
    createdAt: user.createdAt
  };
}

function serializeAdminDiary(diary) {
  return {
    _id: diary._id,
    id: diary._id,
    title: diary.title || '（未命名日記）',
    content: diary.text || '',
    text: diary.text || '',
    mood: diary.mood,
    visibility: diary.visibility,
    location: diary.location,
    locationAccuracy: diary.locationAccuracy || 'precise',
    imageUrl: diary.imageUrl || '',
    createdAt: diary.createdAt,
    lastEditedAt: diary.lastEditedAt || null,
    editCount: diary.editCount || 0,
    author: diary.user
      ? {
          _id: diary.user._id,
          id: diary.user._id,
          name: diary.user.name,
          userCode: diary.user.userCode || '',
          avatar: diary.user.avatar || ''
        }
      : null
  };
}

router.get('/stats', requireAdminOrOwner, async (_req, res, next) => {
  try {
    const today = startOfToday();
    const [
      totalUsers,
      totalDiaries,
      publicDiaries,
      friendsDiaries,
      privateDiaries,
      todayUsers,
      todayDiaries
    ] = await Promise.all([
      User.countDocuments(),
      Diary.countDocuments(),
      Diary.countDocuments({ visibility: 'public' }),
      Diary.countDocuments({ visibility: 'friends' }),
      Diary.countDocuments({ visibility: 'private' }),
      User.countDocuments({ createdAt: { $gte: today } }),
      Diary.countDocuments({ createdAt: { $gte: today } })
    ]);

    res.json({
      success: true,
      message: '取得管理員統計成功',
      data: {
        totalUsers,
        totalDiaries,
        publicDiaries,
        friendsDiaries,
        privateDiaries,
        todayUsers,
        todayDiaries
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users', requireAdminOrOwner, async (req, res, next) => {
  try {
    const search = req.query.search?.toString().toLowerCase().trim();
    const role = req.query.role?.toString().trim();
    const { page, limit, skip } = parsePagination(req.query);
    const query = {};

    if (search) {
      const pattern = escapeRegex(search);
      query.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { userCode: { $regex: pattern, $options: 'i' } },
        { email: { $regex: pattern, $options: 'i' } }
      ];
    }

    if (ROLES.includes(role)) {
      query.role = role;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select(adminUserFields)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      message: '取得使用者列表成功',
      data: {
        items: users.map(serializeAdminUser),
        pagination: buildPagination(page, limit, total)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/role', requireOwner, async (req, res, next) => {
  try {
    const nextRole = req.body.role?.toString().trim();

    if (!ROLES.includes(nextRole)) {
      return res.status(400).json({
        success: false,
        message: '無效的權限角色'
      });
    }

    if (req.params.id === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '不可修改自己的權限'
      });
    }

    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '找不到使用者'
      });
    }

    targetUser.role = nextRole;
    await targetUser.save();

    res.json({
      success: true,
      message: '使用者權限已更新',
      data: serializeAdminUser(targetUser)
    });
  } catch (error) {
    next(error);
  }
});

function requireOwnerForUserDelete(req, res, next) {
  if (req.user?.role === 'owner') {
    next();
    return;
  }

  return res.status(403).json({
    success: false,
    message: '只有 Owner 可以刪除使用者'
  });
}

async function removeUserReactions(targetUserId) {
  const diaries = await Diary.find({ 'reactedUsers.userId': targetUserId });

  await Promise.all(
    diaries.map(async (diary) => {
      const remainingReactions = [];

      for (const reaction of diary.reactedUsers || []) {
        if (reaction.userId?.toString() === targetUserId.toString()) {
          const type = reaction.type;

          if (type && diary.reactions?.[type] !== undefined) {
            diary.reactions[type] = Math.max(0, (diary.reactions[type] || 0) - 1);
          }

          continue;
        }

        remainingReactions.push(reaction);
      }

      diary.reactedUsers = remainingReactions;
      diary.markModified('reactions');
      await diary.save();
    })
  );
}

router.delete('/users/:id', requireOwnerForUserDelete, async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: '不可刪除自己的帳號'
      });
    }

    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '找不到使用者'
      });
    }

    await removeUserReactions(targetUser._id);

    await Promise.all([
      Diary.deleteMany({ user: targetUser._id }),
      User.updateMany(
        {
          $or: [
            { friends: targetUser._id },
            { 'friendRequests.from': targetUser._id }
          ]
        },
        {
          $pull: {
            friends: targetUser._id,
            friendRequests: { from: targetUser._id }
          }
        }
      )
    ]);

    await targetUser.deleteOne();

    res.json({
      success: true,
      message: '使用者已刪除',
      data: {
        deletedUserId: req.params.id
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/diaries', requireAdminOrOwner, async (req, res, next) => {
  try {
    const search = req.query.search?.toString().trim();
    const visibility = req.query.visibility?.toString().trim();
    const mood = req.query.mood?.toString().trim();
    const { page, limit, skip } = parsePagination(req.query);
    const query = {};

    if (VISIBILITIES.includes(visibility)) {
      query.visibility = visibility;
    }

    if (mood && mood !== 'all') {
      query['mood.type'] = mood;
    }

    if (search) {
      const pattern = escapeRegex(search);
      const authorIds = await User.find({ userCode: { $regex: pattern, $options: 'i' } }).distinct('_id');
      query.$or = [
        { title: { $regex: pattern, $options: 'i' } },
        { text: { $regex: pattern, $options: 'i' } },
        { user: { $in: authorIds } }
      ];
    }

    const [diaries, total] = await Promise.all([
      Diary.find(query)
        .populate('user', adminDiaryUserFields)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Diary.countDocuments(query)
    ]);

    res.json({
      success: true,
      message: '取得日記列表成功',
      data: {
        items: diaries.map(serializeAdminDiary),
        pagination: buildPagination(page, limit, total)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/diaries/:id', requireAdminOrOwner, async (req, res, next) => {
  try {
    const diary = await Diary.findById(req.params.id);

    if (!diary) {
      return res.status(404).json({
        success: false,
        message: '找不到日記'
      });
    }

    await diary.deleteOne();

    res.json({
      success: true,
      message: '日記已由管理員刪除',
      data: { id: req.params.id }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
