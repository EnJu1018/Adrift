import Ajv from 'ajv';
import { createHmac, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { AiServiceError } from './gemini.js';

export const OLLAMA_MODEL = 'qwen3.5:4b-q4_K_M';
const fail = (category, status = 502, providerStatus) => new AiServiceError(category, status, providerStatus);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const idPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const abortReason = signal => signal.reason instanceof AiServiceError ? signal.reason
  : signal.reason?.name === 'TimeoutError' ? fail('timeout', 504) : new DOMException('Cancelled', 'AbortError');
const schemaKeys = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'description', 'title',
  'minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems']);

function checkSchemaShape(schema, depth = 0) {
  if (!object(schema) || depth > 8 || Object.keys(schema).some(key => !schemaKeys.has(key))) throw fail('invalid_input', 400);
  if (object(schema.properties)) for (const [name, child] of Object.entries(schema.properties)) {
    if (['__proto__', 'constructor', 'prototype'].includes(name)) throw fail('invalid_input', 400);
    checkSchemaShape(child, depth + 1);
  }
  if (schema.items) checkSchemaShape(schema.items, depth + 1);
  if (object(schema.additionalProperties)) checkSchemaShape(schema.additionalProperties, depth + 1);
}

export function loopbackUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw fail('configuration', 503); }
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw fail('configuration', 503);
  return url.origin;
}

export function compileOutputSchema(schema) {
  if (!object(schema) || JSON.stringify(schema).length > 5000) throw fail('invalid_input', 400);
  checkSchemaShape(schema);
  try {
    const validate = new Ajv({ strict: true, allErrors: false }).compile(schema);
    if (validate.$async) throw fail('invalid_input', 400);
    return validate;
  }
  catch { throw fail('invalid_input', 400); }
}

export function normalizeOllamaInput(kind, input, { model = OLLAMA_MODEL, allow8k = false } = {}) {
  if (!['chat', 'generate'].includes(kind) || !object(input) || input.model !== undefined && input.model !== model) throw fail('invalid_input', 400);
  const contextLength = input.contextLength ?? 4096, maxOutputTokens = input.maxOutputTokens ?? 512;
  if (![4096, 8192].includes(contextLength) || contextLength === 8192 && !allow8k
    || !Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 1024) throw fail('invalid_input', 400);
  const format = input.format;
  if (format !== undefined && format !== 'json') compileOutputSchema(format);
  const tools = input.tools;
  if (tools !== undefined && (kind !== 'chat' || !Array.isArray(tools) || !tools.length || tools.length > 4 || format !== undefined)) throw fail('invalid_input', 400);
  const names = new Set();
  for (const tool of tools || []) {
    const fn = tool?.function;
    if (tool?.type !== 'function' || !object(fn) || typeof fn.name !== 'string' || !idPattern.test(fn.name) || names.has(fn.name)
      || typeof fn.description !== 'string' || fn.description.length > 500) throw fail('invalid_input', 400);
    names.add(fn.name); compileOutputSchema(fn.parameters);
  }
  let content;
  if (kind === 'chat') {
    if (!Array.isArray(input.messages) || !input.messages.length || input.messages.length > 8
      || input.messages.some(item => !object(item) || !['system', 'user', 'assistant'].includes(item.role)
        || typeof item.content !== 'string' || Object.keys(item).some(key => !['role', 'content'].includes(key)))
      || !input.messages.some(item => item.role === 'user' && item.content.trim())) throw fail('invalid_input', 400);
    content = { messages: input.messages.map(({ role, content }) => ({ role, content })) };
  } else {
    if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.system !== undefined && typeof input.system !== 'string') throw fail('invalid_input', 400);
    content = { prompt: input.prompt, ...(input.system ? { system: input.system } : {}) };
  }
  // UTF-8 bytes are a deliberately conservative input guard, not an exact tokenizer.
  const inputBytes = Buffer.byteLength(JSON.stringify({ ...content, format, tools }));
  if (inputBytes + maxOutputTokens + 1024 > contextLength) throw fail('context_limit', 413);
  return { ...content, ...(format !== undefined ? { format } : {}), ...(tools ? { tools } : {}), contextLength, maxOutputTokens };
}

export function validateOllamaOutput(kind, value, input, model = OLLAMA_MODEL) {
  if (!object(value) || value.model !== model || value.done !== true) throw fail('invalid_response');
  if (value.done_reason === 'length') throw fail('truncated_response');
  if (value.done_reason && value.done_reason !== 'stop') throw fail('invalid_response');
  const text = kind === 'chat' ? value.message?.content : value.response;
  const toolCalls = kind === 'chat' ? value.message?.tool_calls : undefined;
  if (typeof text !== 'string' || kind === 'chat' && value.message?.role !== 'assistant') throw fail('invalid_response');
  if (toolCalls !== undefined && (!Array.isArray(toolCalls) || toolCalls.length > 4)) throw fail('invalid_tool_call');
  for (const call of toolCalls || []) {
    const definition = input.tools?.find(tool => tool.function.name === call?.function?.name);
    if (!definition || !object(call.function.arguments) || !compileOutputSchema(definition.function.parameters)(call.function.arguments)) throw fail('invalid_tool_call');
  }
  let json;
  if (input.format !== undefined) {
    try { json = JSON.parse(text); } catch { throw fail('invalid_response'); }
    if (input.format !== 'json' && !compileOutputSchema(input.format)(json)) throw fail('invalid_response');
  }
  if (!text.trim() && !toolCalls?.length) throw fail('empty_response');
  if (!Number.isInteger(value.prompt_eval_count) || value.prompt_eval_count < 0 || !Number.isInteger(value.eval_count) || value.eval_count < 0
    || value.prompt_eval_count + input.maxOutputTokens > input.contextLength || value.eval_count > input.maxOutputTokens) throw fail('context_limit', 413);
  const metrics = { promptTokens: value.prompt_eval_count, outputTokens: value.eval_count };
  for (const [field, name] of [['total_duration', 'durationMs'], ['load_duration', 'loadMs'], ['eval_duration', 'generationMs']]) {
    if (Number.isFinite(value[field]) && value[field] >= 0) metrics[name] = value[field] / 1e6;
  }
  return { model, text, ...(input.format !== undefined ? { json } : {}), toolCalls: toolCalls || [], metrics };
}

async function readJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw fail('invalid_response');
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 131072) { await reader.cancel(); throw fail('invalid_response'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) { if (error instanceof AiServiceError || error.name === 'AbortError') throw error; throw fail('invalid_response'); }
  finally { reader.releaseLock(); }
}

export function createOllamaProvider({ baseUrl, token, model = OLLAMA_MODEL, allow8k = false, target = 'gateway', timeoutMs = 43000, fetchImpl = fetch, logger = console } = {}) {
  const origin = loopbackUrl(baseUrl || (target === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:11435'));
  if (!['gateway', 'ollama'].includes(target) || model !== OLLAMA_MODEL || target === 'gateway' && (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(token))
    || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw fail('configuration', 503);
  const requests = new Map();
  async function request(path, body, { signal, requestId = randomUUID(), feature = 'generation', subject = 'server', deadline = timeoutMs, method = body ? 'POST' : 'GET' } = {}) {
    if (typeof requestId !== 'string' || !idPattern.test(requestId) || !['generation', 'insights', 'memory_chat', 'health', 'smoke'].includes(feature)
      || typeof subject !== 'string' || !subject.length || subject.length > 100 || requests.has(requestId)) throw fail('invalid_input', 400);
    if (signal?.aborted) throw abortReason(signal);
    const controller = new AbortController(), started = Date.now();
    const cancel = () => controller.abort(abortReason(signal));
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(fail('timeout', 504)), deadline);
    requests.set(requestId, controller);
    let onAbort;
    const aborted = new Promise((_, reject) => { onAbort = () => reject(controller.signal.reason); controller.signal.addEventListener('abort', onAbort, { once: true }); });
    try {
      const work = async () => {
        const response = await fetchImpl(origin + path, { method, redirect: 'error', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId, 'X-AI-Feature': feature,
            ...(target === 'gateway' ? { Authorization: `Bearer ${token}`, 'X-AI-Subject': createHmac('sha256', token).update(subject).digest('hex') } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}) });
        let value;
        try { value = await readJson(response); }
        catch (error) { if (response.ok) throw error; value = {}; }
        if (!response.ok) {
          if (!object(value)) value = {};
          const accepted = ['queue_full', 'queue_timeout', 'busy', 'timeout', 'circuit_open', 'recovery_required', 'ollama_offline', 'model_not_found', 'gpu_oom', 'invalid_response', 'invalid_tool_call', 'context_limit'];
          if (target === 'gateway' && accepted.includes(value.code)) throw fail(value.code, response.status, response.status);
          const message = typeof value.error === 'string' ? value.error : '';
          const category = response.status === 404 ? 'model_not_found' : [401, 403].includes(response.status) ? 'provider_auth'
            : /out of memory|cuda.*memory|not enough.*memory|requires more.*memory/i.test(message) ? 'gpu_oom'
            : response.status === 504 ? 'timeout' : response.status === 400 ? 'provider_config' : 'provider_unavailable';
          throw fail(category, category === 'timeout' ? 504 : category === 'gpu_oom' || response.status >= 500 ? 503 : 502, response.status);
        }
        return value;
      };
      return await Promise.race([work(), aborted]);
    } catch (cause) {
      const error = controller.signal.aborted ? controller.signal.reason : cause instanceof AiServiceError ? cause : fail(target === 'gateway' ? 'tunnel_unavailable' : 'ollama_offline', 503);
      if (error.category === 'ollama_offline' && cause.cause?.code === 'ECONNREFUSED') error.notStarted = true;
      logger.warn('Local AI request failed', { requestId, feature, model, category: error?.category || 'cancelled', durationMs: Date.now() - started });
      throw error;
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', cancel); controller.signal.removeEventListener('abort', onAbort); requests.delete(requestId);
    }
  }
  async function run(kind, input) {
    const normalized = normalizeOllamaInput(kind, input, { model, allow8k });
    if (input.signal !== undefined && !(input.signal instanceof AbortSignal) || input.deadline !== undefined
      && (!Number.isInteger(input.deadline) || input.deadline < 1 || input.deadline > timeoutMs)) throw fail('invalid_input', 400);
    input = { ...input, requestId: input.requestId || randomUUID() };
    const body = target === 'ollama' ? { model, ...normalized, contextLength: undefined, maxOutputTokens: undefined, stream: false, think: false,
      keep_alive: '5m', options: { num_ctx: normalized.contextLength, num_predict: normalized.maxOutputTokens, temperature: 0 } } : { ...normalized, model };
    const { signal, requestId, feature, subject, deadline } = input;
    const result = await request(target === 'ollama' ? `/api/${kind}` : `/v1/${kind}`, body, { signal, requestId, feature, subject, deadline });
    if (!object(result)) throw fail('invalid_response');
    const wire = target === 'ollama' ? result : { model: result.model, done: true,
      ...(kind === 'chat' ? { message: { role: 'assistant', content: result.text, tool_calls: result.toolCalls } } : { response: result.text }),
      prompt_eval_count: result.metrics?.promptTokens, eval_count: result.metrics?.outputTokens,
      total_duration: result.metrics?.durationMs * 1e6, load_duration: result.metrics?.loadMs * 1e6, eval_duration: result.metrics?.generationMs * 1e6 };
    const output = validateOllamaOutput(kind, wire, normalized, model);
    logger.info('Local AI request', { requestId: input.requestId, feature: input.feature || 'generation', model,
      promptTokens: output.metrics.promptTokens, outputTokens: output.metrics.outputTokens, durationMs: output.metrics.durationMs, status: 'success' });
    return { ...output, requestId };
  }
  return {
    generate: input => run('generate', input), chat: input => run('chat', input),
    cancel(requestId) { const request = requests.get(requestId); request?.abort(new DOMException('Cancelled', 'AbortError')); return Boolean(request); },
    async healthCheck({ signal } = {}) {
      if (signal !== undefined && !(signal instanceof AbortSignal)) throw fail('invalid_input', 400);
      if (target === 'gateway') return request('/health', undefined, { signal, feature: 'health', deadline: 5000 });
      const healthSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(4500)]);
      const get = async (path, body) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try { return await request(path, body, { signal: healthSignal, feature: 'health', deadline: 1500 }); }
          catch (error) {
            if (attempt || !['ollama_offline', 'provider_unavailable'].includes(error.category) || healthSignal.aborted) throw error;
            await delay(100, undefined, { signal: healthSignal });
          }
        }
      };
      const version = await get('/api/version');
      const info = await get('/api/show', { model });
      const running = await get('/api/ps');
      if (typeof version.version !== 'string' || !Array.isArray(info.capabilities) || !Array.isArray(running.models)) throw fail('invalid_response');
      const loaded = running.models.find(item => item.name === model || item.model === model);
      return { reachable: true, available: true, version: version.version, model, capabilities: info.capabilities.filter(item => ['completion', 'tools', 'thinking'].includes(item)),
        loaded: Boolean(loaded), loadedModelCount: running.models.length, contextLength: loaded?.context_length || null, vramBytes: loaded?.size_vram || 0 };
    }
  };
}
