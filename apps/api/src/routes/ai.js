import express from 'express';
import { randomUUID } from 'node:crypto';
import Diary from '../models/Diary.js';
import { requireAdminOrOwner, requireAuth } from '../middleware/auth.js';
import { generateLifeMapInsight, getRequiredDiaryCount } from '../services/lifeMapAi.js';
import { limitAiRequests, reserveAiUsage } from '../services/aiLimits.js';
import { answerMemoryQuestion, validateChatInput } from '../services/memoryChat.js';
import { getIntelligenceOverview } from '../services/intelligenceOverview.js';
import { createSocialLimiter } from '../services/friendRelationships.js';
import { classifyAiError } from '../services/gemini.js';
import { getEmotionStatistics, searchUserDiaries } from '../services/diaryRetrieval.js';
import { generateAiJson, getAiProviderStatus } from '../services/aiProvider.js';

function sendAiError(res, cause, requestId, feature, started) {
  const error = cause.status === 400 && !cause.category ? cause : classifyAiError(cause);
  console.warn('AI request failed', { requestId, feature, category: error.category || 'input', status: error.status, providerStatus: error.providerStatus, durationMs: Date.now() - started });
  const message = error.status === 400 ? error.message
    : error.category === 'quota' ? 'AI 分析目前請求較多，請稍後再試。'
    : error.category === 'timeout' ? '整理記憶花了較長時間，請稍後重新嘗試。'
    : error.category === 'network' ? '連線暫時中斷，請稍後重試。'
    : error.category === 'retrieval' ? '記憶資料暫時無法讀取，請稍後重試。'
    : error.category === 'stale_evidence' ? '引用的日記已更新或移除，請重新整理這次回顧。'
    : error.category === 'unauthorized' ? '無法存取這些記憶，請確認登入狀態。'
    : ['queue_full', 'busy', 'queue_timeout'].includes(error.category) ? '本地分析目前忙碌，請稍後再試。'
    : error.category === 'context_limit' ? '本次內容超過分析容量，請縮小查詢範圍後再試。'
    : ['tunnel_unavailable', 'ollama_offline', 'circuit_open', 'recovery_required', 'gpu_oom'].includes(error.category) ? '本地智慧服務暫時無法連線，記錄統計仍可使用。'
    : ['invalid_response', 'empty_response', 'truncated_response', 'invalid_citation'].includes(error.category) ? '這次回覆不完整，請重新嘗試。'
    : '智慧服務暫時未能完成，請稍後重新嘗試。';
  return res.set('Retry-After', error.status === 429 ? '60' : '10').status(error.status).json({ success: false, message, code: error.category || 'input', requestId,
    ...(feature === 'memory_chat' && error.status !== 400 ? { stage: ['retrieval', 'stale_evidence'].includes(error.category) ? 'RETRIEVAL_ERROR' : error.category === 'unauthorized' ? 'UNAUTHORIZED' : 'AI_ERROR' } : {}),
    ...(error.evidence || error.queryContext ? { data: { ...(error.evidence ? { evidence: error.evidence } : {}), ...(error.queryContext ? { queryContext: error.queryContext } : {}) } } : {}) });
}

export function createAiRouter({ DiaryModel = Diary, reserve = reserveAiUsage, generate, auth = requireAuth, providerStatus = getAiProviderStatus } = {}) {
const router = express.Router();
const active = new Set();
router.use((req, res, next) => { req.aiRequestId = randomUUID(); res.set('X-Request-ID', req.aiRequestId); next(); });
router.use(auth);

router.get('/provider-status', requireAdminOrOwner, createSocialLimiter(12), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json({ success: true, data: await providerStatus({ provider: req.query.provider }) }); }
  catch (error) { res.status(error.status === 400 ? 400 : 503).json({ success: false, code: error.category || 'unavailable', message: '智慧服務健康檢查暫時無法完成。' }); }
});

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
    const runGenerate = generate || (input => generateAiJson({ ...input, subject: String(req.user._id) }));
    const data = await answerMemoryQuestion({ ...input, userId: req.user._id, Diary: DiaryModel, reserve, generate: runGenerate, signal: controller.signal, requestId: req.aiRequestId });
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
    const asOf = new Date();
    const statistics = await getEmotionStatistics(DiaryModel, req.user._id, { asOf });
    const { diaries } = await searchUserDiaries(DiaryModel, req.user._id, { asOf }, { limit: 40 });

    const required = getRequiredDiaryCount();
    if (controller.signal.aborted) return;

    if (statistics.total < required) {
      return res.json({
        success: true,
        message: '日記數量不足，暫時無法產生完整分析',
        data: {
          notEnoughData: true,
          required,
          current: statistics.total
        }
      });
    }

    await reserve(req.user._id);
    const runGenerate = generate || (input => generateAiJson({ ...input, subject: String(req.user._id) }));
    const insight = await generateLifeMapInsight(diaries, controller.signal, { generate: runGenerate, requestId: req.aiRequestId, statistics });
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
