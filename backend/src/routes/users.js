import bcrypt from 'bcryptjs';
import express from 'express';
import Diary from '../models/Diary.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { EMAIL_PATTERN } from '../constants/app.js';

const router = express.Router();
const publicUserFields = '_id name avatar userCode';

function getFriendshipStatus(currentUser, targetUser) {
  const currentId = currentUser._id.toString();
  const targetId = targetUser._id.toString();

  if (currentId === targetId) return 'self';

  if ((currentUser.friends || []).some((id) => id.toString() === targetId)) {
    return 'friend';
  }

  if ((targetUser.friendRequests || []).some((request) => request.from.toString() === currentId && request.status === 'pending')) {
    return 'sent_request';
  }

  if ((currentUser.friendRequests || []).some((request) => request.from.toString() === targetId && request.status === 'pending')) {
    return 'received_request';
  }

  return 'none';
}

function serializeUser(user) {
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    userCode: user.userCode || '',
    role: user.role || 'user',
    avatar: user.avatar || '',
    createdAt: user.createdAt
  };
}

router.get('/me', requireAuth, async (req, res) => {
  res.json({
    success: true,
    message: '取得帳號資料成功',
    data: serializeUser(req.user)
  });
});

router.patch('/me/name', requireAuth, async (req, res, next) => {
  try {
    const name = req.body.name?.trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: '使用者名稱不可為空'
      });
    }

    if (name.length < 2 || name.length > 30) {
      return res.status(400).json({
        success: false,
        message: '使用者名稱長度需為 2 到 30 字元'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    res.json({
      success: true,
      message: '使用者名稱已更新',
      data: {
        name: user.name,
        user: serializeUser(user)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/me/email', requireAuth, async (req, res, next) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '請輸入 Email 和目前密碼'
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email 格式不正確'
      });
    }

    const existingUser = await User.findOne({
      email,
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '此 Email 已被使用'
      });
    }

    const user = await User.findById(req.user._id);
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: '密碼錯誤，無法修改 Email'
      });
    }

    user.email = email;
    await user.save();

    res.json({
      success: true,
      message: 'Email 已更新',
      data: {
        email: user.email,
        user: serializeUser(user)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/me/password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: '請輸入目前密碼'
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密碼至少需要 6 個字元'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: '兩次輸入的新密碼不一致'
      });
    }

    const user = await User.findById(req.user._id);
    const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: '目前密碼錯誤'
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({
      success: true,
      message: '密碼已更新',
      data: {}
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const { password, confirmText } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: '請輸入目前密碼'
      });
    }

    if (confirmText !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: '請輸入 DELETE 確認刪除帳號'
      });
    }

    const user = await User.findById(req.user._id);
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: '目前密碼錯誤'
      });
    }

    await Promise.all([
      Diary.deleteMany({ user: user._id }),
      User.updateMany({ friends: user._id }, { $pull: { friends: user._id } }),
      User.updateMany({}, { $pull: { friendRequests: { from: user._id } } })
    ]);

    await User.deleteOne({ _id: user._id });

    res.json({
      success: true,
      message: '帳號已刪除',
      data: {}
    });
  } catch (error) {
    next(error);
  }
});

router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const userCode = req.query.userCode?.toString().toLowerCase().trim();

    if (!userCode) {
      return res.status(400).json({
        success: false,
        message: '請輸入使用者 ID'
      });
    }

    const [currentUser, user] = await Promise.all([
      User.findById(req.user._id).select('friends friendRequests'),
      User.findOne({ userCode }).select(`${publicUserFields} friendRequests`)
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '找不到此使用者'
      });
    }

    res.json({
      success: true,
      message: '搜尋成功',
      data: {
        _id: user._id,
        name: user.name,
        avatar: user.avatar || '',
        userCode: user.userCode || '',
        friendshipStatus: getFriendshipStatus(currentUser, user)
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
