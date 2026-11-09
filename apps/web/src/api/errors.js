const messages = {
  network: '連線暫時中斷，請檢查網路後重試。',
  timeout: '整理記憶花了較長時間，請稍後重新嘗試。',
  invalid_response: '服務回覆不完整，請稍後重新嘗試。',
  invalid_citation: '這次回覆的日記引用未能通過驗證，請重新嘗試。',
  stale_evidence: '引用的日記已更新或移除，請重新提問。',
  quota: 'AI 分析目前請求較多，請稍後再試。',
  in_progress: '這個問題正在處理中，請稍候。',
  retrieval: '記憶資料暫時無法讀取，請稍後重試。',
  configuration: '智慧服務尚未就緒，請稍後再試。',
  unauthorized: '登入已過期，請重新登入。',
  context_limit: '本次內容超過分析容量，請縮小查詢範圍後再試。'
};
for (const code of ['queue_full', 'queue_timeout', 'busy']) messages[code] = '智慧服務目前忙碌，請稍後再試。';
for (const code of ['tunnel_unavailable', 'ollama_offline', 'circuit_open', 'recovery_required', 'gpu_oom', 'provider_unavailable', 'provider_auth', 'model_not_found', 'provider_config', 'unavailable']) messages[code] = '智慧服務暫時無法使用，記錄統計仍可使用。';
for (const code of ['empty_response', 'truncated_response', 'invalid_tool_call']) messages[code] = messages.invalid_response;

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const safeId = value => typeof value === 'string' && /^[a-f\d-]{16,64}$/i.test(value) ? value : undefined;

export async function readApiPayload(response) {
  if (!/application\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel();
    return null;
  }
  try {
    const payload = await response.json();
    return object(payload) ? payload : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export function apiError({ status = 0, payload, requestId, retryAfter, code } = {}) {
  code ||= typeof payload?.code === 'string' && /^[a-z_]{1,40}$/.test(payload.code) ? payload.code : undefined;
  const fallback = status === 401 ? '登入已過期，請重新登入。'
    : status === 403 ? '目前沒有權限執行這項操作。'
    : status === 404 ? '找不到這項服務，請稍後再試。'
    : status === 429 ? '請求較多，請稍後再試。'
    : [408, 504].includes(status) ? messages.timeout
    : [502, 503].includes(status) ? '服務暫時無法連線，請稍後再試。'
    : '目前無法完成這項操作，請稍後重試。';
  // Only ordinary localized validation messages are shown verbatim, never server/proxy diagnostics.
  const supplied = status >= 400 && status < 500 && typeof payload?.message === 'string'
    && payload.message.length <= 240 && /[\u3400-\u9fff]/.test(payload.message)
    && !/<|https?:|bearer |AIza|sk-|password|secret|stack/i.test(payload.message) ? payload.message : null;
  const message = supplied || messages[code] || fallback;
  return Object.assign(new Error(message), {
    status, code: code || (status ? 'http_error' : 'network'),
    requestId: safeId(requestId) || safeId(payload?.requestId),
    retryAfter: /^\d+$/.test(String(retryAfter)) ? Math.min(Number(retryAfter), 3600) : undefined,
    // Preserve authorized evidence/query state, not arbitrary HTML or upstream error fields.
    payload: object(payload) ? {
      success: false, message, code, requestId: safeId(requestId) || safeId(payload.requestId),
      ...(['AI_ERROR', 'RETRIEVAL_ERROR', 'UNAUTHORIZED'].includes(payload.stage) ? { stage: payload.stage } : {}),
      ...(object(payload.data) ? { data: {
        ...(object(payload.data.evidence) ? { evidence: payload.data.evidence } : {}),
        ...(object(payload.data.queryContext) ? { queryContext: payload.data.queryContext } : {})
      } } : {})
    } : null
  });
}
