import Ajv from 'ajv';
import { createHash, randomUUID } from 'node:crypto';
import { AiServiceError } from './gemini.js';
import { diaryPeriodStart, getAuthorizedDiaryDetails, getDiaryTimeline, getEmotionStatistics, searchUserDiaries, validateDiaryCitations } from './diaryRetrieval.js';
import { parseMemoryRange, validateMemoryFilters } from './memoryQuery.js';

const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const string = (maxLength, minLength = 1) => ({ type: 'string', minLength, maxLength });
const array = (items, maxItems, minItems = 0) => ({ type: 'array', items, minItems, maxItems });
const number = { type: 'number', minimum: 0 }, count = { type: 'integer', minimum: 0 };
const nullableNumber = { type: ['number', 'null'] }, boolean = { type: 'boolean' };
const moodTypes = ['calm', 'joy', 'sad', 'wonder', 'anxious', 'confused', 'nostalgic', 'other'];
const periods = { last_week: '最近一週', last_month: '最近一個月', last_3_months: '最近三個月', last_6_months: '最近半年',
  last_year: '最近一年', previous_month: '上個月', this_year: '今年', previous_year: '去年' };
const filters = {
  timeRange: { type: 'string', enum: ['all_time', ...Object.keys(periods), 'custom'], description: 'Relative to server time, Asia/Taipei. last_month/year are rolling; previous_month/year are calendar periods.' },
  startDate: string(10), endDate: string(10), city: string(120), place: string(120),
  mood: { type: 'string', enum: moodTypes, description: 'joy means happy/開心' }, keywords: array(string(60), 4)
};
const paging = { limit: { type: 'integer', minimum: 1, maximum: 10 }, cursor: string(36), sort: { type: 'string', enum: ['asc', 'desc'] } };
const groupBy = { type: 'string', enum: ['week', 'month'] };
const id = string(24, 24), date = string(24, 24);
const mood = object({ type: { type: 'string', enum: moodTypes }, intensity: nullableNumber });
const diary = object({ id, title: string(50, 0), content: string(2000, 0), mood, createdAt: date, updatedAt: date,
  place: string(120, 0), visibility: { type: 'string', enum: ['private', 'friends', 'public'] }, contentTruncated: boolean });
const source = object({ id, revision: string(64, 64), field: { type: 'string', enum: ['text'] }, start: count, end: count, createdAt: date, place: string(120, 0) });
const moodCount = object({ type: { type: 'string', enum: moodTypes }, count });
const period = object({ start: date, end: date, count, moods: array(moodCount, 8), intensityCount: count, averageIntensity: nullableNumber,
  evidenceStatus: { type: 'string', enum: ['NO_RECORDS', 'INSUFFICIENT_EVIDENCE', 'AVAILABLE'] } });
const coverage = object({ periodsLimited: boolean, coveredDiaryCount: count, missingPeriodCount: count,
  note: { type: 'string', enum: ['Missing records are not evidence of an unchanged mood.'] } });
const statistics = {
  total: count, averageIntensity: nullableNumber, intensityCount: count, moods: array(object({ type: moodCount.properties.type, count, intensityCount: count, averageIntensity: nullableNumber }), 8),
  groupBy, periods: array(period, 120), missingPeriods: array(date, 120), coverage,
  places: array(object({ place: string(120, 0), count, moods: array(moodCount, 8) }), 10), sampleIds: array(id, 5),
  cityDistribution: object({ cities: array(object({ city: string(20), count, moods: array(moodCount, 8) }), 20), unclassifiedCount: count })
};
const nextCursor = { type: ['string', 'null'], maxLength: 36 };
const statuses = ['SUCCESS', 'NO_RESULTS', 'INVALID_ARGUMENTS', 'UNAUTHORIZED', 'NOT_FOUND', 'RETRIEVAL_ERROR', 'TIMEOUT'];
const evidenceStates = ['AVAILABLE', 'NO_DIARIES', 'NO_MATCHES', 'INSUFFICIENT_EVIDENCE', 'UNAUTHORIZED', 'RETRIEVAL_ERROR', 'INVALID_ARGUMENTS', 'TIMEOUT', 'NOT_FOUND'];
const meta = object({ requestId: string(36), durationMs: number, asOf: date, timezone: { type: 'string', enum: ['Asia/Taipei'] },
  evidenceState: { type: 'string', enum: evidenceStates }, range: { type: ['object', 'null'], properties: { start: date, end: date, endInclusive: boolean }, required: ['start', 'end', 'endInclusive'], additionalProperties: false } });
const ajv = new Ajv({ strict: true });
const envelope = data => object({ tool: string(64), status: { type: 'string', enum: statuses }, data: { anyOf: [data, { type: 'null' }] }, count,
  sources: array(source, 10), metadata: meta });
const registry = {
  search_diaries: {
    description: 'Search own diaries by time, city/place, mood or keywords. Returns excerpts and a page cursor, not full history.',
    inputSchema: object({ ...filters, ...paging }, ['timeRange']), outputSchema: envelope(object({ diaries: array(diary, 10), nextCursor })),
    async handler(context, args, query) {
      const page = await searchUserDiaries(context.Diary, context.owner, query, context.page(args));
      return context.pageResult(page, args, query, 180);
    }
  },
  get_diary_details: {
    description: 'Read full text of 1 or 2 diary IDs. Always rechecks ownership. Never accepts user IDs.',
    inputSchema: object({ diaryIds: array(id, 2, 1) }), outputSchema: envelope(object({ diaries: array(diary, 2) })),
    async handler(context, args) {
      const records = await getAuthorizedDiaryDetails(context.Diary, context.owner, args.diaryIds);
      return { data: { diaries: records.map(item => context.record(item, 2000)) }, count: records.length, records, state: 'AVAILABLE' };
    }
  },
  get_emotion_statistics: {
    description: 'Exact backend mood counts, intensities and missing week/month periods. Do not calculate counts from search samples.',
    inputSchema: object({ ...filters, groupBy }, ['timeRange', 'groupBy']), outputSchema: envelope(object(statistics)),
    async handler(context, args, query) {
      const stats = await getEmotionStatistics(context.Diary, context.owner, query, { periodGroup: args.groupBy });
      const { diaries: records } = await searchUserDiaries(context.Diary, context.owner, query, { limit: 5 });
      return { data: { total: stats.total, averageIntensity: stats.averageIntensity,
        intensityCount: stats.moods.reduce((sum, row) => sum + row.intensityCount, 0),
        moods: stats.moods.map(({ _id, ...row }) => ({ type: _id, ...row })), groupBy: args.groupBy, periods: stats.periods,
        missingPeriods: stats.periods.filter(row => !row.count).map(row => row.start), coverage: context.coverage(stats),
        places: stats.places.map(row => ({ place: row._id, count: row.count, moods: row.moods })), sampleIds: records.map(row => row.id), cityDistribution: stats.cityDistribution },
        records, count: stats.total, state: stats.status, sourceLength: 0 };
    }
  },
  summarize_diary_timeline: {
    description: 'Chronological diary page and exact week/month counts. Deterministic records only; not AI-written events or importance ranking.',
    inputSchema: object({ ...filters, groupBy, limit: paging.limit, cursor: paging.cursor }, ['timeRange', 'groupBy']),
    outputSchema: envelope(object({ total: count, groupBy, periods: array(object({ ...period.properties, diaryIds: array(id, 10) }), 120),
      diaries: array(diary, 10), nextCursor, coverage, selection: { type: 'string', enum: ['chronological_page_not_importance_ranking'] } })),
    async handler(context, args, query) {
      const page = await getDiaryTimeline(context.Diary, context.owner, query, context.page(args));
      const result = await context.pageResult(page, args, query, 180);
      const stats = await getEmotionStatistics(context.Diary, context.owner, query, { periodGroup: args.groupBy });
      result.data = { ...result.data, total: stats.total, groupBy: args.groupBy, coverage: context.coverage(stats),
        periods: stats.periods.map(row => ({ ...row, diaryIds: page.diaries.filter(item => +diaryPeriodStart(item.createdAt, args.groupBy) === +row.start).map(item => item.id) })),
        selection: 'chronological_page_not_importance_ranking' };
      result.state = stats.status;
      return result;
    }
  }
};
for (const tool of Object.values(registry)) {
  tool.authorization = 'Authenticated owner only; all own visibilities; no other accounts.';
  tool.validateInput = ajv.compile(tool.inputSchema);
  tool.validateOutput = ajv.compile(tool.outputSchema);
}
export function diaryToolDefinitions() {
  return structuredClone(Object.entries(registry).map(([name, tool]) => ({ type: 'function', function: { name, description: tool.description, parameters: tool.inputSchema } })));
}
export function diaryToolContracts() {
  return structuredClone(Object.entries(registry).map(([name, { description, inputSchema, outputSchema, authorization }]) => ({ name, description, inputSchema, outputSchema, authorization })));
}
const invalid = () => Object.assign(new Error('Invalid tool arguments'), { status: 400 });
const safeJson = value => JSON.parse(JSON.stringify(value));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function queryFor(args, now) {
  if (!args.timeRange) return null;
  let range = null;
  if (args.timeRange === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(args.endDate || '')) throw invalid();
    range = parseMemoryRange(`${args.startDate} 到 ${args.endDate}`, now);
  } else {
    if (args.startDate !== undefined || args.endDate !== undefined) throw invalid();
    if (args.timeRange !== 'all_time') range = parseMemoryRange(periods[args.timeRange], now);
  }
  if ([args.place, args.city, ...(args.keywords || [])].some(value => value !== undefined && !value.trim())) throw invalid();
  return validateMemoryFilters({ range, place: args.place, city: args.city, mood: args.mood, terms: args.keywords || [], asOf: now });
}

// Server-only factory: pass req after requireAuth, never request body or model arguments.
export function createDiaryToolSession(req, { Diary, now = () => new Date(), timeoutMs = 6500, logger = console } = {}) {
  const owner = String(req?.user?._id || '');
  if (!/^[a-f\d]{24}$/i.test(owner)) throw new AiServiceError('unauthorized', 401);
  if (!Diary || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw invalid();
  const asOf = new Date(now()), expires = Date.now() + 10 * 60000;
  if (!Number.isFinite(+asOf)) throw invalid();
  const evidence = new Map(), cursors = new Map();
  let calls = 0, busy = false, closed = false;
  const record = (item, length) => {
    const { source: ignored, ...fields } = item;
    return { ...fields, content: item.content.slice(0, length), contentTruncated: item.content.length > length };
  };
  const context = { Diary, owner, record,
    page(args) { return { limit: args.limit ?? 5, cursor: args.cursor ? cursors.get(args.cursor).position : null, order: args.sort || 'desc' }; },
    coverage(stats) { return { periodsLimited: stats.periodsLimited, coveredDiaryCount: stats.periods.reduce((sum, row) => sum + row.count, 0),
      missingPeriodCount: stats.periods.filter(row => !row.count).length, note: 'Missing records are not evidence of an unchanged mood.' }; },
    async pageResult(page, args, query, length) {
      let nextCursor = null;
      if (page.nextCursor) {
        nextCursor = randomUUID();
        cursors.set(nextCursor, { position: page.nextCursor, fingerprint: fingerprint(args, query) });
      }
      const stats = page.diaries.length ? null : await getEmotionStatistics(Diary, owner, query);
      return { data: { diaries: page.diaries.map(item => record(item, length)), nextCursor }, records: page.diaries,
        count: page.diaries.length, state: stats?.status || 'AVAILABLE', sourceLength: length };
    }
  };
  const fingerprint = (args, query) => digest({ args: { ...args, cursor: undefined }, query });
  const live = () => !closed && Date.now() <= expires;
  return {
    definitions: diaryToolDefinitions,
    async execute(name, args, { signal } = {}) {
      const started = Date.now(), requestId = randomUUID(), tool = Object.hasOwn(registry, name) ? registry[name] : null;
      const result = (status, state = status) => ({ tool: typeof name === 'string' ? name.slice(0, 64) || 'unknown' : 'unknown', status, data: null, count: 0, sources: [],
        metadata: { requestId, durationMs: Date.now() - started, asOf: asOf.toISOString(), timezone: 'Asia/Taipei', evidenceState: state, range: null } });
      if (!live()) return result('UNAUTHORIZED');
      if (!tool) return result('NOT_FOUND');
      if (busy || calls >= 32 || signal?.aborted) return result(signal?.aborted ? 'TIMEOUT' : 'INVALID_ARGUMENTS');
      let query;
      try {
        if (!tool.validateInput(args) || Buffer.byteLength(JSON.stringify(args)) > 2048) throw invalid();
        query = queryFor(args, asOf);
        if (args.cursor && cursors.get(args.cursor)?.fingerprint !== fingerprint(args, query)) throw invalid();
      } catch { return result('INVALID_ARGUMENTS'); }
      calls++; busy = true;
      let timer, abort;
      try {
        const expired = new Promise((_, reject) => {
          const timeout = () => reject(Object.assign(new Error('Tool timeout'), { status: 504 }));
          timer = setTimeout(timeout, timeoutMs); abort = timeout;
          signal?.addEventListener('abort', abort, { once: true });
        });
        const work = Promise.resolve().then(() => tool.handler(context, args, query));
        work.finally(() => { busy = false; }).catch(() => {});
        const output = await Promise.race([work, expired]);
        const response = safeJson({ ...result(output.count ? 'SUCCESS' : 'NO_RESULTS', output.state), data: output.data, count: output.count,
          sources: output.records.map(item => ({ id: item.id, ...item.source, type: undefined, end: Math.min(item.content.length, output.sourceLength ?? 2000), createdAt: item.createdAt, place: item.place })),
          metadata: { ...result('SUCCESS', output.state).metadata, range: query?.range || null } });
        if (!live()) return result('UNAUTHORIZED');
        if (!tool.validateOutput(response) || Buffer.byteLength(JSON.stringify(response)) > 49152) throw new Error('Invalid tool output');
        for (const item of output.records) {
          const servedEnd = Math.min(item.content.length, output.sourceLength ?? 2000);
          const previous = evidence.get(item.id);
          evidence.set(item.id, { record: item, end: previous?.record.source.revision === item.source.revision ? Math.max(previous.end, servedEnd) : servedEnd });
          if (evidence.size > 64) evidence.delete(evidence.keys().next().value);
        }
        return response;
      } catch (error) {
        const status = error.status === 504 || error.name === 'AbortError' ? 'TIMEOUT' : error.category === 'unauthorized' ? 'UNAUTHORIZED'
          : error.status === 400 ? 'INVALID_ARGUMENTS' : 'RETRIEVAL_ERROR';
        logger.warn('Diary tool failed', { requestId, tool: name, status, durationMs: Date.now() - started });
        return result(status);
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    },
    async validateCitations(citations) {
      if (!live()) throw new AiServiceError('unauthorized', 401);
      if (!Array.isArray(citations) || !citations.length || citations.length > 16) throw new AiServiceError('invalid_citation');
      for (const item of citations) {
        const seen = evidence.get(item?.id);
        if (!seen || Object.keys(item).some(key => !['id', 'start', 'end', 'quote'].includes(key))
          || !Number.isInteger(item.start) || !Number.isInteger(item.end) || item.start < 0 || item.end <= item.start || item.end > seen.end
          || typeof item.quote !== 'string' || item.quote !== seen.record.content.slice(item.start, item.end)) throw new AiServiceError('invalid_citation');
      }
      return validateDiaryCitations(Diary, owner, [...new Set(citations.map(item => item.id))], [...evidence.values()].map(item => item.record));
    },
    close() { closed = true; evidence.clear(); cursors.clear(); }
  };
}
