import { GoogleGenerativeAI } from '@google/generative-ai';

const requiredDiaryCount = 3;
const defaultModelName = 'gemini-2.0-flash';
const fallbackModelNames = ['gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];

const systemPrompt = `
你是 Adrift 的 Life Map AI。

你的任務是分析使用者的：
日記內容
地點
情緒
時間模式

並整理出：
情緒趨勢
地點與情緒關聯
行為模式
個人化建議

請使用溫和、支持性、非醫療診斷的語氣。
不可進行心理疾病診斷。
不可使用過度絕對的語氣。
請使用繁體中文。
請只回傳 JSON。
`;

const outputShape = {
  summary: '',
  moodTrend: {
    description: '',
    dominantMood: '',
    averageIntensity: 0
  },
  locationInsights: [
    {
      place: '',
      insight: '',
      dominantMood: ''
    }
  ],
  behaviorPatterns: [],
  suggestions: []
};

function getCandidateModelNames() {
  return [process.env.GEMINI_MODEL || defaultModelName, ...fallbackModelNames].filter(
    (name, index, list) => name && list.indexOf(name) === index
  );
}

function getModel(modelName) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.35
    }
  });
}

export function getRequiredDiaryCount() {
  return requiredDiaryCount;
}

export function serializeDiaryForAi(diary) {
  const [lng, lat] = diary.location?.coordinates || [];

  return {
    title: diary.title || '',
    content: diary.text || '',
    mood: {
      type: diary.mood?.type || '',
      intensity: diary.mood?.intensity || null
    },
    location: {
      placeName: diary.location?.placeName || '',
      lat,
      lng
    },
    createdAt: diary.createdAt,
    visibility: diary.visibility
  };
}

export async function generateLifeMapInsight(diaries) {
  const serializedDiaries = diaries.map(serializeDiaryForAi);

  const prompt = [
    systemPrompt,
    '請根據以下 Adrift 日記資料產生人生地圖洞察。',
    '只使用提供的資料，不要分析其他使用者，也不要做心理疾病或醫療診斷。',
    '請依照這個 JSON 結構回傳，不要加入 Markdown 或其他文字：',
    JSON.stringify(outputShape),
    '日記資料：',
    JSON.stringify(serializedDiaries)
  ].join('\n\n');

  let lastError;

  for (const modelName of getCandidateModelNames()) {
    try {
      const model = getModel(modelName);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return parseGeminiJson(text);
    } catch (error) {
      lastError = error;

      if (!isRetryableGeminiError(error)) {
        break;
      }

      console.warn(`Gemini model ${modelName} failed, trying fallback model if available.`);
    }
  }

  throw lastError;
}

function isRetryableGeminiError(error) {
  const status = Number(error?.status);
  return [429, 500, 502, 503, 504].includes(status);
}

export function parseGeminiJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Gemini response is empty');
  }

  const cleaned = stripMarkdownJson(text.trim());

  try {
    return normalizeLifeMapInsight(JSON.parse(cleaned));
  } catch (error) {
    const extracted = extractJsonObject(cleaned);

    if (!extracted) {
      throw error;
    }

    return normalizeLifeMapInsight(JSON.parse(extracted));
  }
}

function stripMarkdownJson(value) {
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonObject(value) {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return '';
  }

  return value.slice(start, end + 1);
}

function normalizeLifeMapInsight(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('Gemini JSON is not an object');
  }

  return {
    summary: stringify(value.summary),
    moodTrend: {
      description: stringify(value.moodTrend?.description),
      dominantMood: stringify(value.moodTrend?.dominantMood),
      averageIntensity: numberOrZero(value.moodTrend?.averageIntensity)
    },
    locationInsights: normalizeLocationInsights(value.locationInsights),
    behaviorPatterns: normalizeStringArray(value.behaviorPatterns),
    suggestions: normalizeStringArray(value.suggestions)
  };
}

function normalizeLocationInsights(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      place: stringify(item.place),
      insight: stringify(item.insight),
      dominantMood: stringify(item.dominantMood)
    }));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => stringify(item)).filter(Boolean);
}

function stringify(value) {
  return typeof value === 'string' ? value : '';
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
