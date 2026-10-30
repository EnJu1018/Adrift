import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { cursorQuery, pageCursor } from '../utils/cursor.js';
import { normalizeTaiwanPlaceName } from '../utils/locationFormatter.js';
import { AiServiceError } from './gemini.js';
import { buildMemoryMatch, localDate, validateMemoryFilters } from './memoryQuery.js';

export const diaryIntensity = { $cond: [{ $and: [{ $isNumber: '$mood.intensity' }, { $gte: ['$mood.intensity', 1] }, { $lte: ['$mood.intensity', 5] }] }, '$mood.intensity', null] };
const fields = 'title text mood createdAt updatedAt location.placeName visibility';
const monthFormatter = new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit' });
const invalid = () => Object.assign(new Error('查詢條件不正確，請重新提問。'), { status: 400 });
const unauthorized = status => Object.assign(new AiServiceError('unauthorized', status), { code: 'UNAUTHORIZED' });

function ownerId(value) {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)) return new mongoose.Types.ObjectId(value);
  throw unauthorized(401);
}

async function read(operation) {
  try { return await operation(); }
  catch (error) { if (error instanceof AiServiceError) throw error; throw new AiServiceError('retrieval', 503); }
}

export function diarySource(diary) {
  const createdAt = new Date(diary.createdAt), updatedAt = new Date(diary.updatedAt || diary.createdAt);
  const mood = { type: diary.mood?.type || 'other', intensity: Number.isFinite(diary.mood?.intensity) && diary.mood.intensity >= 1 && diary.mood.intensity <= 5 ? diary.mood.intensity : null };
  const entry = { id: String(diary._id), title: String(diary.title || ''), content: String(diary.text || ''), mood,
    createdAt, updatedAt, place: String(diary.location?.placeName || ''), visibility: diary.visibility };
  const revision = createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  return { ...entry, source: { type: 'diary', revision, field: 'text', start: 0, end: entry.content.length }, contentTruncated: false };
}

export async function searchUserDiaries(Diary, userId, query = {}, { limit = 20, cursor = null, order = 'desc' } = {}) {
  const user = ownerId(userId), filter = validateMemoryFilters(query);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || !['asc', 'desc'].includes(order)
    || cursor !== null && (typeof cursor !== 'string' || cursor.length > 100 || cursor.split('|').length !== 2)) throw invalid();
  let paging;
  try { paging = cursorQuery(cursor); } catch { throw invalid(); }
  if (order === 'asc' && paging.$or) {
    const date = paging.$or[0].createdAt.$lt, id = paging.$or[1]._id.$lt;
    paging = { $or: [{ createdAt: { $gt: date } }, { createdAt: date, _id: { $gt: id } }] };
  }
  const match = buildMemoryMatch(user, filter);
  if (paging.$or) (match.$and ||= []).push(paging);
  const direction = order === 'asc' ? 1 : -1;
  const records = await read(() => Diary.find(match).select(fields).sort({ createdAt: direction, _id: direction }).limit(limit + 1).maxTimeMS(5000).lean());
  if (!Array.isArray(records)) throw new AiServiceError('retrieval', 503);
  return { diaries: records.slice(0, limit).map(diarySource), nextCursor: pageCursor(records, limit), asOf: filter.asOf };
}

export async function getAuthorizedDiaryDetails(Diary, userId, ids) {
  const user = ownerId(userId);
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) throw invalid();
  const unique = [...new Set(ids.map(id => id.toLowerCase()))];
  const records = await read(() => Diary.find({ user, _id: { $in: unique } }).select(fields).maxTimeMS(5000).lean());
  if (!Array.isArray(records)) throw new AiServiceError('retrieval', 503);
  if (records.length !== unique.length) throw unauthorized(403);
  const byId = new Map(records.map(diary => [String(diary._id), diarySource(diary)]));
  return unique.map(id => byId.get(id));
}

export async function validateDiaryCitations(Diary, userId, ids, sources) {
  if (!Array.isArray(sources) || !Array.isArray(ids) || !ids.length || ids.length > 16 || ids.some(id => typeof id !== 'string' || !sources.some(source => source?.id === id))) throw new AiServiceError('invalid_citation');
  let current;
  try { current = await getAuthorizedDiaryDetails(Diary, userId, ids); }
  catch (error) {
    if (error.category === 'unauthorized' && error.status === 403) throw new AiServiceError('stale_evidence', 409);
    throw error;
  }
  if (current.some(item => sources.find(source => source.id === item.id)?.source?.revision !== item.source.revision)) throw new AiServiceError('stale_evidence', 409);
  return current;
}

export function getDiaryTimeline(Diary, userId, query = {}, options = {}) {
  return searchUserDiaries(Diary, userId, query, { ...options, order: 'asc' });
}

function monthlyCoverage(rows, plan) {
  const byMonth = new Map(rows.slice(0, 24).map(row => [row._id, { month: row._id, count: row.count, moods: row.moods,
    averageIntensity: row.intensityCount ? row.intensityTotal / row.intensityCount : null, intensityCount: row.intensityCount }]));
  const first = plan.range?.start ? monthFormatter.format(plan.range.start) : [...byMonth.keys()].sort()[0];
  if (!first) return [];
  const last = monthFormatter.format(new Date(Math.min(plan.asOf, plan.range?.end || plan.asOf) - (plan.range && !plan.range.endInclusive && plan.range.end <= plan.asOf ? 1 : 0)));
  let [year, month] = last.split('-').map(Number);
  const result = [];
  for (let index = 0; index < 24; index++) {
    const key = monthFormatter.format(localDate(year, month));
    if (key < first) break;
    const intersects = !plan.ranges || plan.ranges.some(range => localDate(year, month + 1) > range.start
      && (range.endInclusive ? localDate(year, month) <= range.end : localDate(year, month) < range.end));
    if (intersects) result.push(byMonth.get(key) || { month: key, count: 0, moods: [], averageIntensity: null, intensityCount: 0 });
    if (--month < 1) { month = 12; year--; }
  }
  return result.reverse().map(item => ({ ...item, evidenceStatus: !item.count ? 'NO_RECORDS' : item.count < 3 ? 'INSUFFICIENT_EVIDENCE' : 'AVAILABLE' }));
}

function intensityMean(moods) {
  const count = moods.reduce((sum, mood) => sum + (mood.intensityCount || 0), 0);
  return count ? moods.reduce((sum, mood) => sum + (mood.averageIntensity || 0) * (mood.intensityCount || 0), 0) / count : null;
}

export async function getEmotionStatistics(Diary, userId, query = {}, { includeSamples = false } = {}) {
  const user = ownerId(userId), plan = validateMemoryFilters(query);
  const { user: ignored, ...filter } = buildMemoryMatch(user, plan);
  const within = (...stages) => [{ $match: filter }, ...stages];
  const month = { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Asia/Taipei' } };
  const intensityCount = { $sum: { $cond: [{ $ne: [diaryIntensity, null] }, 1, 0] } };
  const moodGroup = { $group: { _id: '$mood.type', count: { $sum: 1 }, averageIntensity: { $avg: diaryIntensity }, intensityCount } };
  const comparisonFilters = (plan.ranges || []).map(range => { const { user: ignored, ...match } = buildMemoryMatch(user, { ...plan, ranges: null, range }); return match; });
  const [result] = await read(() => Diary.aggregate([
    { $match: { user } },
    { $project: { title: 1, text: 1, mood: 1, createdAt: 1, updatedAt: 1, visibility: 1, 'location.placeName': 1 } },
    { $facet: {
      accountTotal: [{ $count: 'count' }], total: within({ $count: 'count' }),
      moods: within(moodGroup, { $sort: { count: -1, _id: 1 } }),
      monthly: within({ $group: { _id: { month, mood: '$mood.type' }, count: { $sum: 1 }, intensityTotal: { $sum: diaryIntensity }, intensityCount } },
        { $group: { _id: '$_id.month', count: { $sum: '$count' }, intensityTotal: { $sum: '$intensityTotal' }, intensityCount: { $sum: '$intensityCount' }, moods: { $push: { type: '$_id.mood', count: '$count' } } } },
        { $sort: { _id: -1 } }, { $limit: 25 }),
      daily: within({ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Taipei' } }, count: { $sum: 1 }, averageIntensity: { $avg: diaryIntensity }, intensityCount } }, { $sort: { _id: 1 } }, { $limit: 3661 }),
      places: within({ $sort: { createdAt: -1, _id: -1 } },
        { $group: { _id: { place: '$location.placeName', mood: '$mood.type' }, count: { $sum: 1 }, diaryId: { $first: '$_id' }, latestAt: { $first: '$createdAt' } } },
        { $group: { _id: '$_id.place', count: { $sum: '$count' }, moods: { $push: { type: '$_id.mood', count: '$count' } }, latest: { $push: { diaryId: '$diaryId', mood: '$_id.mood', latestAt: '$latestAt' } } } }, { $sort: { count: -1, _id: 1 } }),
      ...Object.fromEntries(comparisonFilters.map((match, index) => [`comparison${index}`, [{ $match: match }, moodGroup]])),
      ...(includeSamples ? {
        temporal: within({ $sort: { createdAt: 1, _id: 1 } }, { $group: { _id: month, first: { $first: '$$ROOT' }, last: { $last: '$$ROOT' } } }, { $sort: { _id: -1 } }, { $limit: 24 }),
        moodSamples: within({ $sort: { 'mood.intensity': -1, createdAt: -1, _id: 1 } }, { $group: { _id: '$mood.type', diary: { $first: '$$ROOT' } } }, { $sort: { _id: 1 } }, { $limit: 8 }),
        diaries: within({ $sort: query.intent === 'mood_extreme' ? { 'mood.intensity': -1, createdAt: -1, _id: 1 } : { createdAt: -1, _id: 1 } }, { $limit: 40 })
      } : {})
    } }
  ]).option({ maxTimeMS: 5000 }));
  if (!result || !['accountTotal', 'total', 'moods', 'monthly', 'places'].every(key => Array.isArray(result[key]))) throw new AiServiceError('retrieval', 503);
  const monthly = monthlyCoverage(result.monthly, plan), places = new Map();
  for (const row of result.places) {
    const name = normalizeTaiwanPlaceName(row._id).trim();
    if (!name) continue;
    const target = places.get(name) || { _id: name, count: 0, moods: [], latest: [] };
    target.count += row.count; target.moods.push(...(row.moods || [])); target.latest.push(...(row.latest || [])); places.set(name, target);
  }
  const namedPlaces = [...places.values()].map(item => ({ ...item,
    moods: [...new Set(item.moods.map(row => row.type))].map(type => ({ type, count: item.moods.filter(row => row.type === type).reduce((sum, row) => sum + row.count, 0) })),
    latest: item.latest.sort((a, b) => new Date(b.latestAt) - new Date(a.latestAt))[0]
  })).sort((a, b) => b.count - a.count || a._id.localeCompare(b._id));
  const total = result.total[0]?.count || 0, accountTotal = result.accountTotal[0]?.count || 0;
  const comparisons = (plan.ranges || []).map((range, index) => {
    const moods = result[`comparison${index}`] || [], total = moods.reduce((sum, mood) => sum + mood.count, 0);
    return { range, total, moods, averageIntensity: intensityMean(moods), status: !total ? 'NO_MATCHES' : total < 3 ? 'INSUFFICIENT_EVIDENCE' : 'AVAILABLE' };
  });
  return { accountTotal, total, moods: result.moods, monthly, daily: (result.daily || []).slice(0, 3660).map(({ _id, ...day }) => ({ date: _id, ...day })), dailyLimited: (result.daily || []).length > 3660,
    averageIntensity: intensityMean(result.moods),
    placeCount: namedPlaces.length, places: namedPlaces.slice(0, 10),
    status: !accountTotal ? 'NO_DIARIES' : !total ? 'NO_MATCHES' : total < 3 || comparisons.some(period => period.status !== 'AVAILABLE') ? 'INSUFFICIENT_EVIDENCE' : 'AVAILABLE',
    monthlyLimited: result.monthly.length > 24 || result.monthly.some(row => row._id < monthly[0]?.month) || Boolean(plan.range && monthFormatter.format(plan.range.start) < monthly[0]?.month),
    comparisons,
    ...(includeSamples ? { candidates: result.diaries || [], temporal: result.temporal || [], moodSamples: result.moodSamples || [] } : {}) };
}
