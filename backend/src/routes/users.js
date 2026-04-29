import express from 'express';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const publicUserFields = '_id name avatar userCode';

router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const userCode = req.query.userCode?.toString().toLowerCase().trim();

    if (!userCode) {
      return res.status(400).json({
        success: false,
        message: '請輸入使用者 ID'
      });
    }

    const user = await User.findOne({
      userCode,
      _id: { $ne: req.user._id }
    }).select(publicUserFields);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '找不到此使用者'
      });
    }

    res.json({
      success: true,
      message: '搜尋成功',
      data: user
    });
  } catch (error) {
    next(error);
  }
});

export default router;
