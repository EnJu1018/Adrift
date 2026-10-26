import { GoogleGenerativeAI } from '@google/generative-ai';
import { setTimeout as delay } from 'node:timers/promises';

export class AiServiceError extends Error {
  constructor(category, status = 502, providerStatus) {
    super(`AI service: ${category}`);
    this.name = 'AiServiceError';
    this.category = category;
    this.status = status;
    this.providerStatus = providerStatus;
  }
}

export function classifyAiError(error) {
  if (error instanceof AiServiceError) return error;
  const status = Number(error.status);
  if (status === 429) return new AiServiceError('quota', 429, status);
  if ([401, 403].includes(status) || status === 400 && error.errorDetails?.some(detail => /^API_KEY/.test(detail.reason))) return new AiServiceError('provider_auth', 502, status);
  if (status === 404) return new AiServiceError('model_not_found', 502, status);
  if (status === 400) return new AiServiceError('provider_config', 502, status);
  if (status === 504 || error.name === 'TimeoutError') return new AiServiceError('timeout', 504, status || undefined);
  if ([500, 502, 503].includes(status)) return new AiServiceError('provider_unavailable', 503, status);
  if (/fetch|network/i.test(error.message) && !status) return new AiServiceError('network', 503);
  return new AiServiceError('unavailable', 503);
}

export function parseGeminiJson(text) {
  if (typeof text !== 'string' || !text.trim()) throw new AiServiceError('empty_response');
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let value;
  try { value = JSON.parse(cleaned); }
  catch { throw new AiServiceError('invalid_response'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiServiceError('invalid_response');
  return value;
}

export async function generateGeminiJson({ instruction, data, schema, signal, requestId, feature = 'generation', timeoutMs = 40000, transport = generate }) {
  signal?.throwIfAborted();
  const started = Date.now(), controller = new AbortController();
  let model = process.env.GEMINI_MODEL?.trim().replace(/^models\//, '');
  const fallback = process.env.GEMINI_FALLBACK_MODEL?.trim().replace(/^models\//, '');
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new AiServiceError('timeout', 504)), timeoutMs);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const attemptSignal = attempt === 0 && fallback && fallback !== model
        ? AbortSignal.any([controller.signal, AbortSignal.timeout(Math.min(15000, timeoutMs))]) : controller.signal;
      let rejectAbort;
      const aborted = new Promise((_, reject) => { rejectAbort = () => reject(attemptSignal.reason); });
      attemptSignal.addEventListener('abort', rejectAbort, { once: true });
      try {
        attemptSignal.throwIfAborted();
        const text = await Promise.race([transport({ instruction, data, schema, model, signal: attemptSignal }), aborted]);
        const result = parseGeminiJson(text);
        console.info('AI provider request', { requestId, feature, model, status: 200, category: 'success', durationMs: Date.now() - started, retryCount: attempt });
        return result;
      } catch (cause) {
        if (signal?.aborted) throw signal.reason;
        const error = classifyAiError(attemptSignal.aborted ? attemptSignal.reason : cause);
        console.warn('AI provider request', { requestId, feature, model, status: error.status, providerStatus: error.providerStatus, category: error.category, durationMs: Date.now() - started, retryCount: attempt });
        const canFallback = fallback && fallback !== model && ['provider_unavailable', 'model_not_found', 'timeout'].includes(error.category);
        // At most two provider requests total; bad credentials, quota and invalid output are never replayed.
        if (controller.signal.aborted || attempt === 1 || !canFallback && error.category !== 'provider_unavailable') throw error;
        if (canFallback) model = fallback;
        try { await delay(800 * 2 ** attempt, undefined, { signal: controller.signal }); }
        catch { throw controller.signal.reason; }
      } finally {
        attemptSignal.removeEventListener('abort', rejectAbort);
      }
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

async function generate({ instruction, data, schema, model: modelName, signal }) {
  if (!process.env.GEMINI_API_KEY || !modelName || !/^[\w.-]+$/.test(modelName)) throw new AiServiceError('configuration', 503);
  const thinkingConfig = /^gemini-[3-9]/.test(modelName) ? { thinkingLevel: 'low' }
    : /^gemini-2\.5-flash/.test(modelName) ? { thinkingBudget: 0 } : undefined;
  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
    model: modelName,
    systemInstruction: instruction,
    // The cap includes thinking tokens, not only the JSON visible to the user.
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, thinkingConfig, maxOutputTokens: 4096 }
  }, { apiVersion: 'v1beta' });
  const { response } = await model.generateContent(JSON.stringify(data), { signal });
  const candidate = response.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') throw new AiServiceError('truncated_response');
  if (response.promptFeedback?.blockReason || candidate?.finishReason && candidate.finishReason !== 'STOP') throw new AiServiceError('blocked_response');
  return candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('') || '';
}
