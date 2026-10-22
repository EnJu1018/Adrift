import { ArrowUp, BookOpen, MapPin, MessageCircle, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { MOOD_LABELS } from '../constants/app.js';
import ButtonFeedback from './ui/ButtonFeedback.jsx';
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
  const busy = messages.some(item => item.status === 'pending');

  const update = updater => onStateChange(current => ({ ...current, chat: updater({ messages: [], draft: '', ...current.chat }) }));
  useEffect(() => () => { request.current?.abort(); citationRequest.current?.abort(); }, []);
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
      update(current => ({ ...current, messages: current.messages.map(item => item.id === answerId
        ? { ...item, status: 'error', error: controller.signal.aborted ? '對話已中止，可以重新提問。' : error.message || '暫時無法回答，請重試。' } : item) }));
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
    catch (error) { if (!controller.signal.aborted) setCitationError(error.message || '日記目前無法開啟，請再試一次。'); }
    finally {
      if (citationRequest.current === controller) {
        citationRequest.current = null;
        setOpening('');
      }
    }
  }

  return <section className="memory-chat" aria-label="Adrift Memory Chat">
    <header className="memory-chat-header">
      <span><MessageCircle size={18} /> Adrift Memory Chat</span>
      <button type="button" className="ghost-button motion-soft-press" onClick={startOver} disabled={!messages.length && !draft}><Plus size={16} />新對話</button>
    </header>
    <div className="memory-chat-transcript" ref={transcript} role="log" aria-label="記憶對話紀錄" aria-live="polite" aria-relevant="additions text"
      onScroll={event => { const el = event.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64; if (nearBottom.current) setHasNew(false); }}>
      {!messages.length && <div className="memory-chat-intro">
        <BookOpen size={28} aria-hidden="true" />
        <h2>和你的記憶聊聊</h2>
        <p>問問 Adrift，你在哪裡留下過快樂、難忘或值得重新回顧的時刻。</p>
        <div className="memory-chat-suggestions">{suggestions.map(text => <button type="button" key={text} onClick={() => send(text)} className="motion-soft-press">{text}<ArrowUp size={15} /></button>)}</div>
      </div>}
      {messages.map(item => <article key={item.id} className={`memory-chat-message ${item.role} motion-fade-in`}>
        <span className="memory-chat-speaker">{item.role === 'user' ? '你' : 'Adrift'}</span>
        {item.status === 'pending' ? <p className="memory-chat-thinking"><span className="button-spinner" aria-hidden="true" />正在尋找你的記憶…</p>
          : item.status === 'error' ? <div className="memory-chat-error"><p role="alert">{item.error}</p><button type="button" className="ghost-button motion-soft-press" onClick={() => send(item.question, item.id)} disabled={busy}><RefreshCw size={15} />重試</button></div>
          : <p className="memory-chat-answer">{item.content}</p>}
        {item.relatedDiaries?.length > 0 && <div className="memory-chat-citations" aria-label="相關記憶">
          <strong>相關記憶</strong>
          {item.relatedDiaries.map((diary, index) => <button type="button" key={diary.id} onClick={() => openDiary(diary.id)} disabled={Boolean(opening)} className="memory-chat-citation motion-soft-press">
            <span className="memory-chat-citation-index">{index + 1}</span>
            <span><strong>{diary.title || '未命名日記'}</strong><small>{new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium' }).format(new Date(diary.createdAt))} · {MOOD_LABELS[diary.mood?.type] || '心情'}</small><small><MapPin size={12} />{diary.place || '未命名地點'}</small></span>
            {opening === diary.id && <span className="button-spinner" />}
          </button>)}
        </div>}
        {item.resultStatus === 'empty' && <button type="button" className="chip-button" onClick={onNewDiary}><Plus size={15} />新增第一篇日記</button>}
      </article>)}
    </div>
    {hasNew && <button type="button" className="memory-chat-latest ghost-button" onClick={() => { nearBottom.current = true; transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'auto' }); setHasNew(false); }}>查看最新回覆</button>}
    <form className="memory-chat-composer" onSubmit={event => { event.preventDefault(); send(); }} aria-busy={busy}>
      {citationError && <p role="alert">{citationError}</p>}
      <label className="memory-chat-input"><span className="sr-only">詢問你的記憶</span>
        <textarea ref={input} value={draft} rows={2} maxLength={1000} placeholder="問問你的城市記憶…" disabled={busy}
          onChange={event => { const value = event.target.value; update(current => ({ ...current, draft: value })); }}
          onInput={event => { event.currentTarget.style.height = 'auto'; event.currentTarget.style.height = `${Math.min(128, event.currentTarget.scrollHeight)}px`; }}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); send(); } }} />
        <button className="primary-button motion-soft-press" type="submit" aria-label="送出記憶問題" disabled={busy || !draft.trim()}><ButtonFeedback busy={busy} label="" icon={<ArrowUp size={18} />} /></button>
      </label>
      <p className="memory-chat-note">只回顧你的日記。提問會將相關日記片段交由 Gemini 整理；回答可能有誤，請對照引用，並非心理診斷。</p>
    </form>
  </section>;
}
