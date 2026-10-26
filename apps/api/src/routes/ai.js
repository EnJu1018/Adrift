import express from 'express';
import { randomUUID } from 'node:crypto';
import Diary from '../models/Diary.js';
import { requireAuth } from '../middleware/auth.js';
import { generateLifeMapInsight, getRequiredDiaryCount } from '../services/lifeMapAi.js';
import { limitAiRequests, reserveAiUsage } from '../services/aiLimits.js';
import { answerMemoryQuestion, validateChatInput } from '../services/memoryChat.js';
import { getIntelligenceOverview } from '../services/intelligenceOverview.js';
import { createSocialLimiter } from '../services/friendRelationships.js';
import { classifyAiError } from '../services/gemini.js';

function sendAiError(res, cause, requestId, feature, started) {
  const error = cause.status === 400 && !cause.category ? cause : classifyAiError(cause);
  console.warn('AI request failed', { requestId, feature, category: error.category || 'input', status: error.status, providerStatus: error.providerStatus, durationMs: Date.now() - started });
  const message = error.status === 400 ? error.message
    : error.category === 'quota' ? 'AI 分析目前請求較多，請稍後再試。'
    : error.category === 'timeout' ? '整理記憶花了較長時間，請稍後重新嘗試。'
    : error.category === 'network' ? '連線暫時中斷，請稍後重試。'
    : error.category === 'retrieval' ? '記憶資料暫時無法讀取，請稍後重試。'
    : ['invalid_response', 'empty_response', 'truncated_response', 'invalid_citation'].includes(error.category) ? '這次回覆不完整，請重新嘗試。'
    : '智慧服務暫時未能完成，請稍後重新嘗試。';
  return res.set('Retry-After', error.status === 429 ? '60' : '10').status(error.status).json({ success: false, message, code: error.category || 'input', requestId,
    ...(feature === 'memory_chat' && error.status !== 400 ? { stage: error.category === 'retrieval' ? 'RETRIEVAL_ERROR' : 'AI_ERROR' } : {}),
    ...(error.evidence ? { data: { evidence: error.evidence } } : {}) });
}

export function createAiRouter({ DiaryModel = Diary, reserve = reserveAiUsage, generate, auth = requireAuth } = {}) {
const router = express.Router();
const active = new Set();
router.use((req, res, next) => { req.aiRequestId = randomUUID(); res.set('X-Request-ID', req.aiRequestId); next(); });
router.use(auth);

router.get('/overview', createSocialLimiter(60), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json({ success: true, data: await getIntelligenceOverview(DiaryModel, req.user._id, req.query.days) }); }
  catch (error) {
    res.status(error.status === 400 ? 400 : 503).json({ success: false, message: error.status === 400 ? error.message : '記錄統計暫時無法載入，請稍後重試。' });
  }
});

router.use(limitAiRequests);

router.post('/chat', async (req, res) => {
  const key = `${req.user._id}:chat`, started = Date.now();
  if (active.has(key)) return res.set('Retry-After', '2').status(409).json({ success: false, code: 'in_progress', message: '記憶對話正在整理中，請稍候。', requestId: req.aiRequestId });
  active.add(key);
  const controller = new AbortController();
  const close = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', close);
  res.set('Cache-Control', 'no-store');
  try {
    const input = validateChatInput(req.body);
    const data = await answerMemoryQuestion({ ...input, userId: req.user._id, Diary: DiaryModel, reserve, generate, signal: controller.signal, requestId: req.aiRequestId });
    if (!controller.signal.aborted) res.json({ success: true, data });
  } catch (error) {
    if (controller.signal.aborted) return;
    sendAiError(res, error, req.aiRequestId, 'memory_chat', started);
  } finally {
    active.delete(key);
    res.off('close', close);
  }
});

router.get('/life-map', async (req, res) => {
  const key = `${req.user._id}:insights`, started = Date.now();
  if (active.has(key)) return res.set('Retry-After', '2').status(409).json({ success: false, code: 'in_progress', message: '智慧洞察正在整理中，請稍候。', requestId: req.aiRequestId });
  active.add(key);
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
    const insight = await generateLifeMapInsight(diaries, controller.signal, { generate, requestId: req.aiRequestId });
    if (controller.signal.aborted) return;

    return res.json({
      success: true,
      message: '取得 Adrift Intelligence 洞察成功',
      data: insight
    });
  } catch (error) {
    if (controller.signal.aborted) return;
    return sendAiError(res, error, req.aiRequestId, 'insights', started);
  } finally {
    active.delete(key);
    res.off('close', close);
  }
});

return router;
}

export default createAiRouter();
