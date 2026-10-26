export const SCOPE_REPLY = '我主要協助你探索 Adrift 中的日記、情緒足跡與生活回憶。你可以問最近的心情，或某個地點留下過哪些記憶。';
const clarify = '你想回顧哪些日記、地點或心情？例如「回顧最近半年的心情變化」。';
const memoryTopic = /日記|記[憶录錄]|回[憶顾顧]|心情|情緒|足跡|生活|平靜|開心|快樂|焦慮|低落|難過|朋友|難忘|diar|memor|mood|feel|anxi|happ|calm|sad|recollect/i;
const offTopic = /(?:寫|教|解釋|debug|write|explain).{0,15}(?:程式|代碼|論文|食譜|java|python|javascript|code|essay|recipe)|(?:java|python|javascript|程式).{0,12}(?:寫|教|如何|怎麼)|天氣|weather|股價|stock price|即時新聞|翻譯|translate/i;
const attack = /忽略.{0,10}(指令|規則)|(?:ignore|override).{0,25}(?:instruction|rule|system)|API.?key|金鑰|密碼|password|(?:其他|別人|所有使用者).{0,8}(?:日記|私人|資料)|(?:other users?|someone else).{0,20}(?:diar|private)|system prompt/i;
const followup = /^(那|再|其中|哪些|哪天|哪一天|哪段|還有|為什麼|可以|幫我整理|改成|改為|換成|不限|全部|所有|what about|which|and |why|tell me more)/i;
const trend = /變化|趨勢|分析|深入|比較|是不是|如何|怎麼樣|trend|change/i;
const moods = [
  ['joy', /開心|快樂|高興|happy|happiest|joy/i], ['calm', /平靜|安穩|calm|peaceful/i],
  ['anxious', /焦慮|不安|anxious|anxiety/i], ['sad', /低落|難過|悲傷|sad/i],
  ['confused', /疑惑|困惑|confused/i], ['nostalgic', /懷念|nostalgic/i], ['wonder', /驚喜|驚嘆|wonder/i]
];
const cities = ['臺北', '新北', '桃園', '新竹', '苗栗', '臺中', '彰化', '南投', '雲林', '嘉義', '臺南', '高雄', '屏東', '宜蘭', '花蓮', '臺東', '澎湖', '基隆', '金門', '海邊', '學校', '咖啡店'];
const cityAliases = { taipei: '臺北', taichung: '臺中', tainan: '臺南', kaohsiung: '高雄' };
const segmenter = new Intl.Segmenter('zh-TW', { granularity: 'word' });
const searchFillers = new Set(['幫我', '找出', '搜尋', '日記', '記憶', '生活', '回憶', '回顧', '最近', '值得', '重新', '哪些', '提到', '包含', '記錄', '上次', '地方', '發生', '心情', '情緒', '我有', '有沒有', '覺得', '難忘', '時刻', '一下', '整理']);
const partsFormatter = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });
const numberPattern = '[一二兩三四五六七八九十百\\d]+';

export function localDate(year, month, day = 1) { return new Date(Date.UTC(year, month - 1, day) - 8 * 3600000); }
function digits(value) {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === '兩') return 2;
  const digit = char => '一二三四五六七八九'.indexOf(char) + 1;
  if (value.includes('十')) { const [a, b] = value.split('十'); return (a ? digit(a) : 1) * 10 + (b ? digit(b) : 0); }
  return digit(value);
}
function dateError() { return Object.assign(new Error('日期或期間不正確，請確認後重新提問。'), { status: 400 }); }
function checkedDate(year, month, day) {
  const value = localDate(year, month, day), local = new Date(value.getTime() + 8 * 3600000);
  if (local.getUTCFullYear() !== year || local.getUTCMonth() + 1 !== month || local.getUTCDate() !== day) throw dateError();
  return value;
}
function monthsAgo(now, months) {
  const local = new Date(now.getTime() + 8 * 3600000);
  const target = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - months, 1));
  const day = Math.min(local.getUTCDate(), new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate());
  return new Date(localDate(target.getUTCFullYear(), target.getUTCMonth() + 1, day).getTime() + local.getUTCHours() * 3600000 + local.getUTCMinutes() * 60000 + local.getUTCSeconds() * 1000 + local.getUTCMilliseconds());
}

export function parseMemoryRange(text, now = new Date()) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(now).map(part => [part.type, part.value]));
  const y = Number(parts.year), m = Number(parts.month), d = Number(parts.day);
  const monthRange = (year, month) => ({ start: localDate(year, month), end: localDate(year, month + 1) });
  const rolling = start => ({ start, end: now, endInclusive: true });
  const dates = [...text.matchAll(/\b(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日|號)?/g)];
  if (dates.length) {
    const start = checkedDate(...dates[0].slice(1).map(Number));
    const last = checkedDate(...dates[Math.min(dates.length - 1, 1)].slice(1).map(Number));
    if (last < start) throw dateError();
    return { start, end: new Date(last.getTime() + 86400000) };
  }
  if (/半年/.test(text)) return rolling(monthsAgo(now, 6));
  const duration = text.match(new RegExp(`(最近|過去|過往|近|改成|改為|換成)?\\s*(${numberPattern})\\s*(個)?(月|年|週|星期|天)(以來|來|內)?`));
  if (duration && !/[哪那某每這的]/.test(text[duration.index - 1] || '') && (duration[1] || duration[3] || duration[5] || duration[4] !== '月' && digits(duration[2]) < 100)) {
    const count = digits(duration[2]), unit = duration[4];
    if (!Number.isInteger(count) || count < 1 || count > (unit === '年' ? 10 : unit === '月' ? 120 : 3660)) throw dateError();
    return rolling(['月', '年'].includes(unit) ? monthsAgo(now, count * (unit === '年' ? 12 : 1)) : new Date(now.getTime() - count * (unit === '天' ? 1 : 7) * 86400000));
  }
  const explicit = text.match(/(?:(\d{4})年?|去年|前年|今年)?\s*(\d{1,2}|十[一二]?|[一二三四五六七八九])月/);
  if (explicit) {
    const month = digits(explicit[2]);
    if (month < 1 || month > 12) throw dateError();
    return monthRange(explicit[1] ? Number(explicit[1]) : /前年/.test(explicit[0]) ? y - 2 : /去年/.test(explicit[0]) ? y - 1 : y, month);
  }
  const year = text.match(/\b(\d{4})年/);
  if (year || /去年|今年|前年|last year|this year/i.test(text)) {
    const selected = year ? Number(year[1]) : /前年/.test(text) ? y - 2 : /去年|last year/i.test(text) ? y - 1 : y;
    return selected === y ? rolling(localDate(y, 1)) : { start: localDate(selected, 1), end: localDate(selected + 1, 1) };
  }
  if (/上個?月|last month/i.test(text)) return monthRange(y, m - 1);
  if (/這個?月|本月|this month/i.test(text)) return rolling(localDate(y, m));
  if (/上週|上星期|last week/i.test(text)) {
    const monday = localDate(y, m, d - (['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday) + 6) % 7);
    return { start: new Date(monday.getTime() - 7 * 86400000), end: monday };
  }
  if (/本週|這週|這星期|this week/i.test(text)) return rolling(localDate(y, m, d - (['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday) + 6) % 7));
  if (/昨天|yesterday/i.test(text)) return { start: localDate(y, m, d - 1), end: localDate(y, m, d) };
  if (/今天|today/i.test(text)) return rolling(localDate(y, m, d));
  if (/最近一週|最近一星期|過去一週|past week/i.test(text)) return rolling(new Date(now.getTime() - 7 * 86400000));
  const english = text.match(/(?:past|last)\s+(\d+|one|three|six)\s+(months?|years?|weeks?|days?)/i);
  if (english) {
    const count = Number(english[1]) || { one: 1, three: 3, six: 6 }[english[1].toLowerCase()];
    if (count < 1 || count > 120) throw dateError();
    return rolling(/month|year/i.test(english[2]) ? monthsAgo(now, count * (/year/i.test(english[2]) ? 12 : 1)) : new Date(now.getTime() - count * (/week/i.test(english[2]) ? 7 : 1) * 86400000));
  }
  if (/最近|近期|recent|past month/i.test(text)) return rolling(monthsAgo(now, 1));
  return null;
}

function placeFrom(text) {
  const normalized = text.replaceAll('台', '臺');
  return cities.find(city => normalized.includes(city)) || Object.entries(cityAliases).find(([alias]) => text.toLowerCase().includes(alias))?.[1]
    || text.match(/(?:在|去|地點是)[「『"]([^」』"]{1,30})[」』"]/u)?.[1]
    || text.match(/(?:我(?:們)?(?:上次|曾經|以前|今天|昨天)?(?:去(?:了|過)?|在)|^在)(?!哪|什麼|甚麼|何處|那裡|這裡)([\p{Script=Han}]{2,15}?)(?=做|留下|記錄|的|時|有|玩|發生|[？?。，]|$)/u)?.[1]
    || text.match(/\b(?:visited|went to|in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)?.[1] || null;
}
export function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function planTurn(message, previous, now) {
  if (attack.test(message) || offTopic.test(message) && !/(日記|記錄|回憶).{0,15}(提到|寫過|記過|當時)/.test(message)) return { scope: 'out_of_scope', answer: SCOPE_REPLY };
  const range = parseMemoryRange(message, now), place = placeFrom(message), mood = moods.find(([, pattern]) => pattern.test(message))?.[0];
  const continuation = Boolean(previous && (followup.test(message) || !memoryTopic.test(message) && (range || place || mood || /深入|整理|明顯|more|deeper/i.test(message))));
  const personalReview = /我|我們|my |I |we /i.test(message) && (place || range) && /去|做了什麼|發生|過得|did|happen|visit/i.test(message);
  if (!memoryTopic.test(message) && !continuation && !personalReview) return { scope: 'clarify', answer: clarify };
  const isTrend = /心情|情緒|mood|feel/i.test(message) && trend.test(message) || Boolean(mood && /比較|變化|趨勢|是不是|常|trend|change/i.test(message));
  const intent = isTrend ? 'mood_trend' : /最開心|最平靜|最難過|happiest/i.test(message) ? 'mood_extreme'
    : continuation && !mood ? previous.intent : 'recall';
  const terms = [];
  if (/朋友|好友|同學|friends?/i.test(message) && !isTrend) terms.push('朋友|好友|同學|friend');
  if (!isTrend && /找|搜|提到|包含|mention|find|search/i.test(message)) {
    const quoted = message.match(/[「『"]([^」』"]{1,30})[」』"]/u)?.[1];
    if (quoted && quoted !== place) terms.push(escapeRegex(quoted));
    else if (!place && !mood && !/難忘|印象深刻|重要時刻|值得回顧/.test(message)) {
      const words = [...segmenter.segment(message)].filter(item => item.isWordLike && item.segment.length >= 2 && !searchFillers.has(item.segment)
        && !/月|年|週|星期|\d/.test(item.segment)).map(item => escapeRegex(item.segment)).slice(0, 4);
      if (words.length) terms.push(words.join('|'));
    }
  }
  return { scope: 'memory', intent, asOf: now,
    range: /不限時間|全部時間|所有日記|全部日記|歷年/.test(message) ? null : range || (continuation ? previous.range : null),
    place: /不限地點|全部地點/.test(message) ? null : place || (continuation ? previous.place : null),
    mood: isTrend || /所有心情|整體心情/.test(message) ? null : mood || (continuation ? previous.mood : null),
    terms: isTrend ? [] : terms.length ? terms : continuation ? previous.terms : [],
    question: message, previous: continuation ? previous.topic : null,
    topic: continuation ? previous.topic : message.slice(0, 500), depth: /深入|分析|deeper/i.test(message) || continuation && previous.depth === 'detailed' ? 'detailed' : 'standard'
  };
}

export function planMemoryQuestion(message, history = [], now = new Date()) {
  let previous = null;
  for (const text of history.slice(-12)) {
    try {
      const plan = planTurn(text, previous, now);
      if (plan.scope === 'memory') previous = plan;
    } catch (error) {
      if (error.status !== 400) throw error;
    }
  }
  return planTurn(message, previous, now);
}

export function buildMemoryMatch(userId, plan) {
  const match = { user: userId };
  if (plan.range) match.createdAt = { $gte: plan.range.start, [plan.range.endInclusive ? '$lte' : '$lt']: plan.range.end };
  else if (plan.asOf) match.createdAt = { $lte: plan.asOf };
  if (plan.mood) match['mood.type'] = plan.mood;
  const patterns = [...(plan.terms || [])];
  if (plan.place) patterns.push(escapeRegex(plan.place).replaceAll('臺', '[台臺]'));
  if (patterns.length) match.$and = patterns.map(pattern => ({ $or: ['title', 'text', 'location.placeName'].map(field => ({ [field]: { $regex: pattern, $options: 'i' } })) }));
  return match;
}
