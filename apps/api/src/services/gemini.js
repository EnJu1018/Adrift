import { GoogleGenerativeAI } from '@google/generative-ai';

export async function generateGeminiJson({ instruction, data, schema, signal, timeoutMs = 20000, transport = generate }) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => { controller.abort(); reject(new DOMException('Request cancelled', 'AbortError')); };
  });
  signal?.addEventListener('abort', abort, { once: true });
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error('AI request timed out'), { status: 504 }));
    }, timeoutMs);
  });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await Promise.race([transport({ instruction, data, schema, signal: controller.signal }), deadline, cancelled]);
        return JSON.parse(text);
      } catch (error) {
        if (controller.signal.aborted || ![500, 502, 503].includes(Number(error.status)) || attempt === 1) throw error;
      }
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function generate({ instruction, data, schema, signal }) {
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) {
    throw Object.assign(new Error('AI service is not configured'), { status: 503 });
  }
  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
    model: process.env.GEMINI_MODEL,
    systemInstruction: instruction,
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2, maxOutputTokens: 1600 }
  });
  const result = await model.generateContent(JSON.stringify(data), { signal });
  return result.response.text();
}
