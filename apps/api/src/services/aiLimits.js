import AiUsage from '../models/AiUsage.js';

const attempts = new Map();
const dailyLimit = () => boundedLimit(process.env.AI_DAILY_LIMIT, 20, 100);
const globalLimit = () => boundedLimit(process.env.AI_GLOBAL_DAILY_LIMIT, 200, 2000);
function boundedLimit(value, fallback, maximum) {
  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, maximum) : fallback;
}

export function limitAiRequests(req, res, next) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
  const key = String(req.user._id);
  const item = attempts.get(key) || { count: 0, resetAt: now + 60000 };
  if (item.count >= 6 || attempts.size >= 10000 && !attempts.has(key)) {
    return res.set('Retry-After', '60').status(429).json({ success: false, message: '提問太頻繁，請稍後再試。' });
  }
  item.count++;
  attempts.set(key, item);
  next();
}

export async function reserveAiUsage(userId, now = new Date(), Usage = AiUsage) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(now);
  const expiresAt = new Date(now.getTime() + 2 * 86400000);
  for (const [key, limit] of [[`all:${day}`, globalLimit()], [`${userId}:${day}`, dailyLimit()]]) {
    try {
      await Usage.updateOne({ _id: key }, { $setOnInsert: { count: 0, expiresAt } }, { upsert: true, maxTimeMS: 5000 });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    const result = await Usage.updateOne({ _id: key, count: { $lt: limit } }, { $inc: { count: 1 } }, { maxTimeMS: 5000 });
    if (!result.modifiedCount) throw Object.assign(new Error('今日智慧功能使用次數已達上限，請明天再試。'), { status: 429 });
  }
}
