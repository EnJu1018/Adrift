import express from 'express';
import Diary from '../models/Diary.js';
import { requireAuth } from '../middleware/auth.js';
import { generateLifeMapInsight, getRequiredDiaryCount } from '../services/lifeMapAi.js';

const router = express.Router();

router.get('/life-map', requireAuth, async (req, res) => {
  try {
    const diaries = await Diary.find({ user: req.user._id })
      .select('title text mood location visibility createdAt')
      .sort({ createdAt: -1 })
      .limit(120);

    const required = getRequiredDiaryCount();

    if (diaries.length < required) {
      return res.json({
        success: true,
        message: '日記數量不足，暫時無法產生完整分析',
        data: {
          notEnoughData: true,
          required,
          current: diaries.length
        }
      });
    }

    const insight = await generateLifeMapInsight(diaries);

    return res.json({
      success: true,
      message: '取得 Adrift AI 人生地圖洞察成功',
      data: insight
    });
  } catch (error) {
    console.error('Life Map AI failed:', error);

    return res.status(503).json({
      success: false,
      message: 'AI 分析暫時無法使用'
    });
  }
});

export default router;
