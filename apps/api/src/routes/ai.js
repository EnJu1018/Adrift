import express from 'express';
import Diary from '../models/Diary.js';
import { requireAuth } from '../middleware/auth.js';
import { generateLifeMapInsight, getRequiredDiaryCount } from '../services/lifeMapAi.js';
import { limitAiRequests, reserveAiUsage } from '../services/aiLimits.js';
import { answerMemoryQuestion, validateChatInput } from '../services/memoryChat.js';

export function createAiRouter({ DiaryModel = Diary, reserve = reserveAiUsage, generate, auth = requireAuth } = {}) {
const router = express.Router();
router.use(auth, limitAiRequests);

router.post('/chat', async (req, res) => {
  const controller = new AbortController();
  const close = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', close);
  res.set('Cache-Control', 'no-store');
  try {
    const input = validateChatInput(req.body);
    const data = await answerMemoryQuestion({ ...input, userId: req.user._id, Diary: DiaryModel, reserve, generate, signal: controller.signal });
    if (!controller.signal.aborted) res.json({ success: true, data });
  } catch (error) {
    if (controller.signal.aborted) return;
    const status = [400, 429].includes(Number(error.status)) ? Number(error.status) : 503;
    if (status === 503) console.error('Memory chat unavailable', { code: Number(error.status) || 503, name: error.name });
    res.set('Retry-After', status === 429 ? '60' : '10').status(status).json({ success: false,
      message: status === 400 ? error.message : status === 429 ? '智慧功能使用量已達限制，請稍後或明天再試。' : '記憶對話暫時無法完成，請稍後重試。'
    });
  } finally {
    res.off('close', close);
  }
});

router.get('/life-map', async (req, res) => {
  const controller = new AbortController();
  const close = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', close);
  try {
    res.set('Cache-Control', 'no-store');
    const diaries = await DiaryModel.find({ user: req.user._id })
      .select('title text mood location visibility createdAt')
      .sort({ createdAt: -1 })
      .limit(120).maxTimeMS(5000).lean();

    const required = getRequiredDiaryCount();
    if (controller.signal.aborted) return;

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

    await reserve(req.user._id);
    const insight = await generateLifeMapInsight(diaries, controller.signal);
    if (controller.signal.aborted) return;

    return res.json({
      success: true,
      message: '取得 Adrift Intelligence 洞察成功',
      data: insight
    });
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error('Adrift Intelligence unavailable', { code: Number(error.status) || 503, name: error.name });

    const status = Number(error.status) === 429 ? 429 : 503;
    return res.set('Retry-After', status === 429 ? '60' : '10').status(status).json({
      success: false,
      message: status === 429 ? '智慧功能使用量已達限制，請稍後或明天再試。' : 'Adrift Intelligence 暫時無法使用'
    });
  } finally {
    res.off('close', close);
  }
});

return router;
}

export default createAiRouter();
