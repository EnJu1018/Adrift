import { ArrowLeft, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { api } from '../api/client.js';
import MemoryChat from './MemoryChat.jsx';
import InsightsView from './intelligence/InsightsView.jsx';
import { normalizeInsight } from './intelligence/insightData.js';
import './intelligence/intelligence.css';

export default function LifeMapAI({ state, onStateChange, onBack, onOpenDiary, onNewDiary }) {
  const panel = useRef(null), request = useRef(null), overviewRequest = useRef(null), pending = useRef(false);
  const insightScroll = useRef(0);
  const callbacks = useRef(null); callbacks.current = onStateChange;
  const tab = state?.tab || 'insights', days = state?.days || 30;
  const insight = state?.insight || null, overview = state?.overview;
  const update = patch => callbacks.current?.(current => ({ ...current, ...patch }));
  function stopOverview() {
    overviewRequest.current?.abort();
    callbacks.current?.(current => current.overview?.status === 'loading' ? { ...current, overview: { ...current.overview, status: current.overview.data ? 'ready' : 'idle' } } : current);
  }
  useEffect(() => () => { request.current?.abort(); stopOverview(); }, []);
  useLayoutEffect(() => { if (tab === 'insights' && panel.current) panel.current.scrollTop = insightScroll.current; }, [tab]);
  useEffect(() => {
    if (tab !== 'chat') return;
    const viewport = window.visualViewport;
    const resize = () => {
      const top = panel.current?.getBoundingClientRect().top || 0;
      panel.current?.style.setProperty('--intel-available', `${Math.max(220, (viewport?.height || innerHeight) + (viewport?.offsetTop || 0) - top - 12)}px`);
      if (panel.current) panel.current.dataset.compactViewport = String((viewport?.height || innerHeight) < 520);
    };
    resize();
    viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize); window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); window.removeEventListener('resize', resize);
      panel.current?.style.removeProperty('--intel-available'); if (panel.current) delete panel.current.dataset.compactViewport;
    };
  }, [tab]);

  async function loadOverview() {
    overviewRequest.current?.abort();
    const controller = new AbortController(); overviewRequest.current = controller;
    update({ overview: { ...overview, status: 'loading', error: '' } });
    try {
      const payload = await api.getIntelligenceOverview(days, controller.signal);
      if (controller.signal.aborted) return;
      if (!payload.data || payload.data.days !== days || !Array.isArray(payload.data.daily)) throw new Error('統計資料不完整，請重新載入。');
      update({ overview: { status: 'ready', data: payload.data, error: '' } });
    } catch (error) { if (!controller.signal.aborted) update({ overview: { ...overview, status: 'error', error: error.message || '記錄統計暫時無法載入。' } }); }
  }
  useEffect(() => {
    if (tab !== 'insights' || overview?.data?.days === days) return;
    loadOverview();
    return stopOverview;
  }, [days, tab]);

  async function generateInsight() {
    if (pending.current) return;
    pending.current = true;
    const controller = new AbortController(); request.current = controller;
    update({ status: 'loading', error: '', dataWarmup: null });
    try {
      const payload = await api.getLifeMapInsight(controller.signal);
      if (controller.signal.aborted) return;
      const data = payload?.data;
      if (data?.notEnoughData) { update({ status: 'notEnoughData', dataWarmup: data }); return; }
      if (!data || typeof data.summary !== 'string' || !data.summary.trim()) throw new Error('洞察內容不完整，請再試一次。');
      update({ status: 'success', insight: normalizeInsight(data), generatedAt: new Date().toISOString(), dataWarmup: null });
    } catch (error) {
      const message = error instanceof TypeError ? '連線暫時中斷，請檢查網路後重試。' : error.message || '暫時無法整理洞察，請稍後重試。';
      update({ status: controller.signal.aborted ? (insight ? 'success' : 'idle') : 'error', error: controller.signal.aborted ? '' : message });
    } finally { if (request.current === controller) { pending.current = false; request.current = null; } }
  }
  function ask(question) {
    callbacks.current?.(current => ({ ...current, tab: 'chat', chat: { ...current.chat, draft: question } }));
    requestAnimationFrame(() => {
      const input = panel.current?.querySelector('.memory-chat-input textarea');
      if (input && !input.disabled) input.focus({ preventScroll: true });
      else panel.current?.querySelector('#intelligence-chat-tab')?.focus({ preventScroll: true });
    });
  }
  function switchTab(next) { update({ tab: next }); }
  return <main ref={panel} className="intelligence-page" data-tab={tab} onScroll={event => { if (tab === 'insights') insightScroll.current = event.currentTarget.scrollTop; }}>
    <div className="intel-shell">
      <header className="intel-header">
        <div><h1>Adrift Intelligence</h1><p><span>從留下的足跡中，</span><span>重新理解自己的生活。</span></p></div>
        <button className="intel-icon-button motion-soft-press" onClick={onBack} aria-label="返回地圖"><ArrowLeft size={19} /></button>
      </header>
      <nav className="intel-tabs" role="tablist" aria-label="Adrift Intelligence 功能" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const next = event.key === 'Home' ? 'insights' : event.key === 'End' ? 'chat' : tab === 'chat' ? 'insights' : 'chat';
        switchTab(next); event.currentTarget.querySelector(`#intelligence-${next}-tab`)?.focus({ preventScroll: true });
      }}>
        <span className="intel-tab-indicator" style={{ transform: `translateX(${tab === 'chat' ? 100 : 0}%)` }} aria-hidden="true" />
        {[['insights', '智慧洞察', Sparkles], ['chat', '記憶對話', MessageCircle]].map(([id, label, Icon]) => <button key={id} id={`intelligence-${id}-tab`} type="button" role="tab" aria-selected={tab === id} aria-controls={`intelligence-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => switchTab(id)}><Icon size={17} />{label}</button>)}
      </nav>
      <div id="intelligence-insights" className="intel-tab-panel" role="tabpanel" aria-labelledby="intelligence-insights-tab" hidden={tab !== 'insights'}>
        <InsightsView state={state} overview={overview} days={days} onRange={days => update({ days })} onRefresh={loadOverview} onGenerate={generateInsight} onAsk={ask} onNewDiary={onNewDiary || onBack} onOpenDiary={onOpenDiary} />
        <p className="intel-privacy"><ShieldCheck size={15} />僅使用你的日記；AI 回顧交由 Gemini 整理，可能有誤，並非醫療或心理診斷。</p>
      </div>
      <div id="intelligence-chat" className="intel-tab-panel" role="tabpanel" aria-labelledby="intelligence-chat-tab" hidden={tab !== 'chat'}>
        <MemoryChat state={state?.chat} onStateChange={onStateChange} onOpenDiary={onOpenDiary} onNewDiary={onNewDiary || onBack} active={tab === 'chat'} />
      </div>
    </div>
  </main>;
}
