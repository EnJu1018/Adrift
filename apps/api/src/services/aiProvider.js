import { AiServiceError, generateGeminiJson } from './gemini.js';
import { createOllamaProvider, OLLAMA_MODEL } from './ollama.js';

function jsonSchema(schema) {
  if (Array.isArray(schema)) return schema.map(jsonSchema);
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, key === 'type' && typeof value === 'string' ? value.toLowerCase() : jsonSchema(value)]));
}

export function createAiProvider({ env = process.env, gemini = generateGeminiJson, ollamaFactory = createOllamaProvider } = {}) {
  let client, configuration;
  function selected() {
    const provider = env.AI_PROVIDER || 'gemini';
    if (!['gemini', 'ollama'].includes(provider)) throw new AiServiceError('configuration', 503);
    return provider;
  }
  function local(verified = true) {
    if (verified && env.OLLAMA_GATEWAY_VERIFIED !== '1') throw new AiServiceError('configuration', 503);
    const config = { baseUrl: env.OLLAMA_GATEWAY_URL || 'http://127.0.0.1:11435', token: env.OLLAMA_GATEWAY_TOKEN,
      model: env.OLLAMA_MODEL || OLLAMA_MODEL, allow8k: env.OLLAMA_ALLOW_8K === '1' };
    const key = JSON.stringify(config);
    if (configuration !== key) { client = ollamaFactory(config); configuration = key; }
    return client;
  }
  return {
    async generateJson(input) {
      if (selected() === 'gemini') return gemini(input);
      const result = await local().chat({ messages: [{ role: 'system', content: input.instruction }, { role: 'user', content: JSON.stringify(input.data) }],
        format: jsonSchema(input.schema), signal: input.signal, requestId: input.requestId, feature: input.feature,
        subject: input.subject || 'server', contextLength: input.contextLength ?? 4096, maxOutputTokens: input.maxOutputTokens ?? 512 });
      return result.json;
    },
    async status({ signal, provider = selected() } = {}) {
      if (!['gemini', 'ollama'].includes(provider)) throw new AiServiceError('invalid_input', 400);
      if (provider === 'gemini') return { provider, status: 'configured_not_probed', configured: Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL) };
      const status = await local(false).healthCheck({ signal });
      if (status?.reachable !== true || !status.upstream || !status.capacity) throw new AiServiceError('invalid_response');
      const upstream = status.upstream, capacity = status.capacity;
      return { provider, model: OLLAMA_MODEL, status: status.status, reachable: true,
        upstream: { reachable: upstream.reachable, available: upstream.available, loaded: upstream.loaded,
          contextLength: upstream.contextLength, vramBytes: upstream.vramBytes },
        capacity: { active: capacity.active, queued: capacity.queued, maxQueue: capacity.maxQueue, concurrency: capacity.concurrency,
          draining: capacity.draining, circuit: capacity.circuit, recoveryRequired: capacity.recoveryRequired,
          timeoutCount: capacity.timeoutCount, lastDurationMs: capacity.lastDurationMs } };
    }
  };
}

const provider = createAiProvider();
export const generateAiJson = input => provider.generateJson(input);
export const getAiProviderStatus = input => provider.status(input);
