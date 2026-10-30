import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createAiCapacity } from '../services/aiCapacity.js';
import { createOllamaProvider, normalizeOllamaInput, OLLAMA_MODEL } from '../services/ollama.js';
import { AiServiceError } from '../services/gemini.js';

export function createLocalAiGateway({ clients, provider, allow8k = false, capacity = createAiCapacity(), logger = console } = {}) {
  if (!Array.isArray(clients) || !clients.length || clients.length > 8
    || clients.some(client => !client || !/^[a-z][a-z0-9-]{0,31}$/.test(client.project) || typeof client.token !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(client.token) || /REPLACE|CHANGE_ME/i.test(client.token))
    || new Set(clients.map(client => client.token)).size !== clients.length || new Set(clients.map(client => client.project)).size !== clients.length) throw new Error('Invalid local gateway client configuration');
  const credentials = clients.map(({ project, token }) => ({ project, hash: createHash('sha256').update(token).digest() }));
  provider ||= createOllamaProvider({ target: 'ollama', allow8k, timeoutMs: 40000 });
  const app = express(); app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    // No browser access, even from a page on the local machine.
    if (req.headers.origin) return res.status(403).json({ code: 'forbidden' });
    const token = /^Bearer ([^\s]{32,256})$/.exec(req.headers.authorization || '')?.[1] || '';
    const hash = createHash('sha256').update(token).digest();
    const client = credentials.find(item => timingSafeEqual(item.hash, hash));
    if (!client) return res.status(401).json({ code: 'unauthorized' });
    req.project = client.project; next();
  });
  app.use(express.json({ limit: '48kb', strict: true }));
  app.get('/health', async (_req, res) => {
    try {
      const upstream = await provider.healthCheck();
      const state = capacity.state();
      const status = state.recoveryRequired ? 'recovery_required' : state.circuit === 'open' ? 'circuit_open' : upstream.loaded ? 'ready' : 'cold';
      res.json({ reachable: true, upstream, capacity: state, status });
    } catch (error) {
      res.status(503).json({ code: error.category || 'ollama_offline', reachable: true, upstream: { reachable: false, available: false }, capacity: capacity.state() });
    }
  });
  app.use('/v1', (req, res, next) => {
    const id = req.headers['x-request-id'], subject = req.headers['x-ai-subject'], feature = req.headers['x-ai-feature'];
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || typeof subject !== 'string' || !/^[a-f\d]{64}$/.test(subject)
      || !['generation', 'insights', 'memory_chat', 'smoke'].includes(feature)) return res.status(400).json({ code: 'invalid_input' });
    req.aiId = id; req.subject = subject; req.feature = feature; res.set('X-Request-ID', id); next();
  });
  for (const kind of ['chat', 'generate']) app.post(`/v1/${kind}`, async (req, res) => {
    const started = Date.now(), controller = new AbortController();
    const close = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', close);
    try {
      const allowed = ['model', 'messages', 'prompt', 'system', 'format', 'tools', 'contextLength', 'maxOutputTokens'];
      if (!req.body || Object.keys(req.body).some(key => !allowed.includes(key))) throw new AiServiceError('invalid_input', 400);
      const input = normalizeOllamaInput(kind, req.body, { allow8k });
      const result = await capacity.submit({ id: req.aiId, project: req.project, subject: req.subject, signal: controller.signal,
        run: signal => provider[kind]({ ...input, signal, requestId: req.aiId, feature: req.feature }) });
      if (!controller.signal.aborted) res.json(result);
      logger.info('AI gateway request', { requestId: req.aiId, project: req.project, feature: req.feature, model: OLLAMA_MODEL,
        status: 'success', durationMs: Date.now() - started, promptTokens: result.metrics.promptTokens, outputTokens: result.metrics.outputTokens });
    } catch (cause) {
      const error = cause instanceof AiServiceError ? cause : new AiServiceError('unavailable', 503);
      logger.warn('AI gateway request failed', { requestId: req.aiId, project: req.project, feature: req.feature,
        model: OLLAMA_MODEL, category: controller.signal.aborted ? 'cancelled' : error.category, durationMs: Date.now() - started });
      if (!controller.signal.aborted) res.set('Retry-After', error.category === 'queue_full' ? '5' : '30').status(error.status).json({ code: error.category, requestId: req.aiId });
    } finally { res.off('close', close); }
  });
  app.delete('/v1/requests/:id', (req, res) => res.status(202).json({ cancelled: capacity.cancel(req.params.id, req.project, req.subject) }));
  app.use((_req, res) => res.status(404).json({ code: 'not_found' }));
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ code: 'invalid_input' }));
  return { app, capacity };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.env.OLLAMA_SHARED_CAPACITY_READY !== '1') throw new Error('Shared capacity must be verified before startup');
    const clients = JSON.parse(process.env.OLLAMA_GATEWAY_CLIENTS || 'null');
    const { app, capacity } = createLocalAiGateway({ clients, allow8k: process.env.OLLAMA_ALLOW_8K === '1' });
    const server = app.listen(11435, '127.0.0.1', () => console.info('Local AI gateway listening on loopback'));
    server.on('error', () => { console.error('Local AI gateway could not bind its loopback port'); process.exitCode = 1; });
    server.requestTimeout = 45000; server.headersTimeout = 5000; server.keepAliveTimeout = 5000; server.maxConnections = 32;
    const stop = () => { capacity.close(); server.close(); setTimeout(() => process.exit(0), 45000).unref(); };
    process.once('SIGTERM', stop); process.once('SIGINT', stop);
  } catch { console.error('Local AI gateway configuration is invalid'); process.exitCode = 1; }
}
