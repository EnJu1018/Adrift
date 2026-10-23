import { ArrowUpRight, BookOpen, ChevronRight, MapPin, MessageCircle, Plus, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';
import ButtonFeedback from '../ui/ButtonFeedback.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { createInsightReveal } from '../../lib/motion/animeMotion.js';
import { moodColors, moodLabel, normalizeInsight, shortDate, trendBins } from './insightData.js';

export default function InsightsView({ state, overview, days, onRange, onRefresh, onGenerate, onAsk, onOpenDiary, onNewDiary }) {
  const data = overview?.data, loading = overview?.status === 'loading';
  const [opening, setOpening] = useState(''), [error, setError] = useState('');
  const citation = useRef(null);
  useEffect(() => () => citation.current?.abort(), []);
  async function openPlace(id) {
    if (!onOpenDiary || citation.current) return;
    const controller = new AbortController(); citation.current = controller; setOpening(id); setError('');
    try { await onOpenDiary(id, controller.signal); }
    catch (error) { if (!controller.signal.aborted) setError([403, 404].includes(error.status) ? '這則記憶已移除或暫時無法開啟，請重新整理統計。' : error.message); }
    finally { if (citation.current === controller) { citation.current = null; setOpening(''); } }
  }
  return <div className="intel-insights">
    <section className="intel-overview" aria-busy={loading}>
      <div className="intel-section-heading"><div><span className="intel-eyebrow">YOUR MEMORY ATLAS</span><h2>你的生活足跡</h2></div>
        <div className="intel-overview-actions"><label><span className="sr-only">統計期間</span><select aria-label="統計期間" value={days} onChange={event => onRange(Number(event.target.value))}>{[7, 30, 90].map(value => <option value={value} key={value}>最近 {value} 天</option>)}</select></label><button className="intel-icon-button" onClick={onRefresh} disabled={loading} aria-label="重新整理記錄統計"><RefreshCw size={17} /></button></div>
      </div>
      <div className="intel-overview-status" role="status">{loading ? data ? `正在讀取最近 ${days} 天，暫時保留最近 ${data.days} 天的統計。` : '正在整理你的日記統計…' : data ? `${shortDate(data.start)} — ${shortDate(data.end)} · 只計算你實際留下的日記` : '以真實記錄為依據，不推測沒有留下的生活。'}</div>
      {data?.count > 0 && <p className="intel-overview-summary">這段日子，你留下了 {data.count} 篇記憶{data.moods[0] ? `，最常記錄的是${moodLabel(data.moods[0].type)}` : ''}。</p>}
      {overview?.error && <div className="intel-error" role="alert"><p>{overview.error}</p><button className="intel-text-button" onClick={onRefresh}>重新載入統計<RefreshCw size={15} /></button></div>}
      {data ? <>
        <dl className="intel-metrics"><div><dt>記憶數量</dt><dd><AnimatedNumber value={data.count} digits={3} /><small>篇</small></dd></div><div><dt>常見心情</dt><dd>{data.moods[0] ? <><span className="intel-mood-dot" style={{ background: moodColors[data.moods[0].type] || moodColors.other }} />{moodLabel(data.moods[0].type)}</> : '—'}</dd></div><div><dt>記錄地點</dt><dd><AnimatedNumber value={data.placeCount} digits={3} /><small>處</small></dd></div></dl>
        {data.count > 0 ? <>
          <div className="intel-chart-grid">
            <section className="intel-chart-section"><div className="intel-section-heading"><h3>情緒分布</h3><span>{data.count} 篇日記</span></div>
              <div className="intel-mood-bars">{data.moods.map(item => <div key={item.type || 'unknown'} className="intel-mood-row"><span><i className="intel-mood-dot" style={{ background: moodColors[item.type] || moodColors.other }} />{moodLabel(item.type)}</span><div className="intel-bar-track" aria-hidden="true"><span style={{ width: `${item.count / data.count * 100}%`, background: moodColors[item.type] || moodColors.other }} /></div><span>{item.count}<small> · {Math.round(item.count / data.count * 100)}%</small></span></div>)}</div>
            </section>
            <TrendChart data={data} onAsk={onAsk} />
          </div>
          <section className="intel-places"><div className="intel-section-heading"><div><h3>記憶經常落腳的地方</h3><p>開啟最近一篇記憶，回到它發生的地點。</p></div><MapPin size={20} /></div>
            {error && <p className="intel-error" role="alert">{error}</p>}
            {data.places.length ? <ol>{data.places.map((place, index) => <li key={place.name}><span className="intel-place-rank">{String(index + 1).padStart(2, '0')}</span><button className="intel-place-link" onClick={() => openPlace(place.diaryId)} disabled={Boolean(opening)}><span><strong>{place.name}</strong><small>最近記錄 · {moodLabel(place.mood)}</small></span>{opening === place.diaryId ? <span className="button-spinner" /> : <ArrowUpRight size={18} />}</button><span className="intel-place-count">{place.count} 篇</span></li>)}</ol> : <p className="intel-muted">這段期間的記憶還沒有可用的地點名稱。</p>}
          </section>
        </> : <div className="intel-empty"><BookOpen size={25} /><h3>這段日子，還沒有留下記錄</h3><p>試試較長的期間，或寫下今天的一個生活片段。</p><button className="intel-button" onClick={onNewDiary}><Plus size={16} />留下新的記憶</button></div>}
      </> : <div className="intel-overview-placeholder" aria-hidden="true"><div /><div /><div /></div>}
    </section>
    <AiReview state={state} onGenerate={onGenerate} onAsk={onAsk} onNewDiary={onNewDiary} />
  </div>;
}

function TrendChart({ data, onAsk }) {
  const bins = useMemo(() => trendBins(data), [data]);
  const points = bins.map((bin, index) => ({ ...bin, x: (index + .5) * 500 / bins.length, y: bin.average === null ? null : 142 - (bin.average - 1) * 28 }));
  const lines = points.slice(1).map((point, index) => point.y !== null && points[index].y !== null ? `M${points[index].x},${points[index].y} L${point.x},${point.y}` : '').join(' ');
  return <section className="intel-chart-section intel-trend"><div className="intel-section-heading"><h3>心情強度趨勢</h3><span>1—5</span></div>
    <div className="intel-trend-plot">
      <svg viewBox="0 0 500 180" preserveAspectRatio="none" aria-hidden="true"><path className="intel-chart-gridlines" d="M0 30H500 M0 86H500 M0 142H500" /><path className="intel-chart-line" d={lines} /></svg>
      <div className="intel-trend-points" style={{ gridTemplateColumns: `repeat(${bins.length}, minmax(0, 1fr))` }}>{points.map(point => {
        const label = `${shortDate(point.start)}～${shortDate(point.end)}，${point.count} 篇日記，${point.average === null ? '沒有強度資料' : `平均強度 ${point.average.toFixed(1)} / 5`}`;
        return <div key={point.start.toISOString()}><Tooltip label={label}><button type="button" className="intel-trend-point" style={{ '--point-y': `${(point.y ?? 155) / 180 * 100}%` }} aria-label={label} onClick={event => event.currentTarget.focus({ preventScroll: true })}><span>{point.average === null ? '—' : point.average.toFixed(1)}</span><i data-empty={point.average === null} /></button></Tooltip><small>{shortDate(point.start)}</small></div>;
      })}</div>
    </div><p className="intel-muted">依期間分組加權平均；空白代表沒有記錄，不代表心情低落。</p>
    <button className="intel-text-button" onClick={() => onAsk(`幫我回顧最近 ${data.days} 天的心情變化`)}><MessageCircle size={15} />深入詢問這段期間<ChevronRight size={15} /></button>
  </section>;
}

function AiReview({ state, onGenerate, onAsk, onNewDiary }) {
  const root = useRef(null), insight = state?.insight ? normalizeInsight(state.insight) : null;
  const loading = state?.status === 'loading';
  const placeObservation = item => <div className="intel-place-insight" key={item.place}><strong>{item.place || '未命名地點'}</strong><p>{item.insight}</p><button className="intel-text-button" onClick={() => onAsk(`我在${item.place}留下過哪些記憶？`)}>探索這裡的記憶<ArrowUpRight size={14} /></button></div>;
  useLayoutEffect(() => insight ? createInsightReveal(root.current) : undefined, [Boolean(insight)]);
  return <section className="intel-review" ref={root} aria-label="AI 生活回顧">
    <div className="intel-section-heading"><div><span className="intel-eyebrow">CONNECT THE MEMORIES</span><h2>讓記憶串成線</h2><p>Gemini 回顧最近最多 40 篇日記；不隨上方統計期間切換。</p></div>
      <button className="intel-button primary motion-soft-press" type="button" onClick={onGenerate} disabled={loading}><ButtonFeedback busy={loading} label={insight ? '更新 AI 回顧' : '產生智慧洞察'} busyLabel="正在整理洞察" icon={insight ? <RefreshCw size={16} /> : <Sparkles size={16} />} /></button></div>
    <div className="intel-review-notice" role={state?.status === 'error' ? 'alert' : 'status'}>{loading ? insight ? '正在更新洞察，仍可閱讀上次的結果。' : '正在根據你的日記整理洞察…' : state?.status === 'error' ? `${state.error || '更新未完成。'}${insight ? '已保留上次的結果，請再試一次。' : '請再試一次，記錄統計仍可使用。'}` : ''}</div>
    {state?.status === 'notEnoughData' && <div className="intel-empty"><h3>讓記憶再累積一點</h3><p>已有 {state.dataWarmup?.current || 0} 篇；至少 {state.dataWarmup?.required || 3} 篇就能串起生活片段。</p><button className="intel-button" onClick={onNewDiary}><Plus size={16} />新增日記</button></div>}
    {insight ? <div className="intel-review-result">
      <div className="intel-review-summary" data-insight-reveal><span className="intel-eyebrow">整體觀察</span><p>{insight.summary}</p>{state.generatedAt && <small className="intel-muted">更新於 {shortDate(state.generatedAt)}</small>}</div>
      <div className="intel-review-grid">
        <section data-insight-reveal><h3><TrendingUp size={18} />情緒與生活</h3><p>{insight.moodTrend.description || '持續記錄後，才能看見更清楚的生活節奏。'}</p><ReviewList items={insight.behaviorPatterns} /></section>
        <section data-insight-reveal><h3><MapPin size={18} />地點與心情</h3>{insight.locationInsights.length ? <>{insight.locationInsights.slice(0, 3).map(placeObservation)}{insight.locationInsights.length > 3 && <details className="intel-more"><summary>其他 {insight.locationInsights.length - 3} 個地點觀察</summary>{insight.locationInsights.slice(3).map(placeObservation)}</details>}</> : <p>目前還沒有足夠的地點關聯。</p>}</section>
      </div>
      <section className="intel-next" data-insight-reveal><h3>下一次，可以試著</h3><ReviewList items={insight.suggestions} /><button className="intel-text-button" onClick={() => onAsk('幫我深入回顧最近一個月的心情變化')}><MessageCircle size={15} />和這段記憶聊聊<ChevronRight size={15} /></button></section>
    </div> : loading && <div className="intel-review-placeholder is-loading" aria-hidden="true"><span /><span /><span /></div>}
  </section>;
}

function ReviewList({ items }) {
  return <><ul>{items.slice(0, 3).map(item => <li key={item}>{item}</li>)}</ul>{items.length > 3 && <details className="intel-more"><summary>其他 {items.length - 3} 項</summary><ul>{items.slice(3).map(item => <li key={item}>{item}</li>)}</ul></details>}</>;
}
