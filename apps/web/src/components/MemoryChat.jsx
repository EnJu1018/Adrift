import { ArrowDown, ArrowUp, BookOpen, MessageCircle, Plus } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import ButtonFeedback from './ui/ButtonFeedback.jsx';
import ChatMessage from './intelligence/ChatMessage.jsx';
import './memoryChat.css';

const suggestions = ['回顧我最近的心情', '哪個地方留下最多回憶？', '我最近有哪些快樂的時刻？', '幫我回顧上個月的生活'];

export default function MemoryChat({ state, onStateChange, onOpenDiary, onNewDiary, active }) {
  const messages = state?.messages || [];
  const draft = state?.draft || '';
  const request = useRef(null);
  const citationRequest = useRef(null);
  const transcript = useRef(null);
  const input = useRef(null);
  const composing = useRef(false);
  const nearBottom = useRef(true);
  const [hasNew, setHasNew] = useState(false);
  const [opening, setOpening] = useState('');
  const [citationError, setCitationError] = useState('');
  const [unavailable, setUnavailable] = useState(new Set());
  const busy = messages.some(item => item.status === 'pending');

  const update = updater => onStateChange(current => ({ ...current, chat: updater({ messages: [], draft: '', ...current.chat }) }));
  useEffect(() => () => { request.current?.abort(); citationRequest.current?.abort(); }, []);
  useLayoutEffect(() => {
    if (!active || !input.current) return;
    input.current.style.height = 'auto';
    input.current.style.height = `${Math.min(128, input.current.scrollHeight)}px`;
  }, [draft, active]);
  useEffect(() => {
    if (!active) return;
    if (nearBottom.current) {
      transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'auto' });
      setHasNew(false);
    } else setHasNew(true);
  }, [messages, active]);

  async function send(question = draft, retryId) {
    const text = question.trim();
    if (!text || text.length > 1000 || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const userId = crypto.randomUUID();
    const answerId = retryId || crypto.randomUUID();
    const context = messages.filter(item => item.role === 'user').slice(-4).map(item => ({ role: 'user', content: item.content }));
    if (retryId && context.at(-1)?.content === text) context.pop();
    nearBottom.current = true;
    update(current => ({ ...current, draft: '', messages: retryId
      ? current.messages.map(item => item.id === retryId ? { ...item, status: 'pending', error: '' } : item)
      : [...current.messages, { id: userId, role: 'user', content: text }, { id: answerId, role: 'assistant', status: 'pending', question: text }]
    }));
    if (input.current) input.current.style.height = '';
    try {
      const payload = await api.chatMemory(text, context, controller.signal);
      if (!payload.data || typeof payload.data.answer !== 'string') throw new Error('回覆不完整，請重試。');
      if (controller.signal.aborted) return;
      const relatedDiaries = Array.isArray(payload.data.relatedDiaries) ? payload.data.relatedDiaries.filter(item => item && typeof item.id === 'string' && Number.isFinite(Date.parse(item.createdAt))) : [];
      update(current => ({ ...current, messages: current.messages.map(item => item.id === answerId
        ? { ...item, ...payload.data, relatedDiaries, resultStatus: payload.data.status, role: 'assistant', content: payload.data.answer, status: 'complete' } : item) }));
    } catch (error) {
      const message = error instanceof TypeError ? '連線暫時中斷，請檢查網路後重試。' : error.message || '暫時無法回答，請重試。';
      update(current => ({ ...current, messages: current.messages.map(item => item.id === answerId
        ? { ...item, status: 'error', error: controller.signal.aborted ? '對話已中止，可以重新提問。' : message } : item) }));
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  function startOver() {
    request.current?.abort();
    request.current = null;
    citationRequest.current?.abort();
    citationRequest.current = null;
    setOpening('');
    update(() => ({ messages: [], draft: '' }));
    setCitationError('');
    setUnavailable(new Set());
    nearBottom.current = true; setHasNew(false);
    if (input.current) input.current.style.height = '';
    input.current?.focus({ preventScroll: true });
  }

  async function openDiary(id) {
    if (citationRequest.current || !onOpenDiary) return;
    const controller = new AbortController();
    citationRequest.current = controller;
    setOpening(id);
    setCitationError('');
    try { await onOpenDiary(id, controller.signal); }
    catch (error) { if (!controller.signal.aborted) {
      if ([403, 404].includes(error.status)) { setUnavailable(current => new Set([...current, id])); setCitationError('這則記憶已移除或目前無法查看。'); }
      else setCitationError(error.message || '日記目前無法開啟，請再試一次。');
    } }
    finally {
      if (citationRequest.current === controller) {
        citationRequest.current = null;
        setOpening('');
      }
    }
  }

  return <section className="memory-chat" aria-label="Adrift Memory Chat">
    <header className="memory-chat-header">
      <div><span><MessageCircle size={17} />Memory Chat</span><small>探索你留下的生活片段</small></div>
      <button type="button" className="intel-text-button motion-soft-press" onClick={startOver} disabled={!messages.length && !draft}><Plus size={16} />新對話</button>
    </header>
    <div className="memory-chat-transcript" ref={transcript} role="log" aria-label="記憶對話紀錄" aria-live="polite" aria-relevant="additions text"
      onScroll={event => { const el = event.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64; if (nearBottom.current) setHasNew(false); }}>
      {!messages.length && <div className="memory-chat-intro">
        <BookOpen size={28} aria-hidden="true" />
        <h2>和你的記憶聊聊。</h2>
        <p>從你的日記、情緒與足跡中，<br className="memory-chat-welcome-break" />找回值得重新回顧的時刻。</p>
        <div className="memory-chat-suggestions">{suggestions.map(text => <button type="button" key={text} onClick={() => send(text)} className="motion-soft-press">{text}<ArrowUp size={15} /></button>)}</div>
      </div>}
      {messages.map(item => <ChatMessage key={item.id} item={item} busy={busy} opening={opening} unavailable={unavailable} onRetry={send} onOpenDiary={openDiary} onNewDiary={onNewDiary} />)}
    </div>
    {hasNew && <button type="button" className="memory-chat-latest intel-button" onClick={() => { nearBottom.current = true; transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'auto' }); setHasNew(false); }}><ArrowDown size={15} />查看最新回覆</button>}
    <form className="memory-chat-composer" onSubmit={event => { event.preventDefault(); send(); }} aria-busy={busy}>
      {citationError && <p role="alert">{citationError}</p>}
      <label className="memory-chat-input"><span className="sr-only">詢問你的記憶</span>
        <textarea ref={input} value={draft} rows={1} maxLength={1000} placeholder="問問 Adrift，你留下過哪些記憶……" disabled={busy}
          onChange={event => { const value = event.target.value; update(current => ({ ...current, draft: value })); }}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); send(); } }} />
        <button className="memory-chat-send motion-soft-press" type="submit" aria-label="送出記憶問題" disabled={busy || !draft.trim()}><ButtonFeedback busy={busy} label="" icon={<ArrowUp size={18} />} /></button>
      </label>
      <p className="memory-chat-note">僅回顧你的日記、情緒與足跡。<span> 相關片段交由 Gemini 整理，請對照引用。</span></p>
    </form>
  </section>;
}
