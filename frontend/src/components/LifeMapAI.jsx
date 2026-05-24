import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Brain,
  Compass,
  Lightbulb,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { fadeUpMotion, listItemMotion, pageFadeUp } from '../constants/animations.js';
import { normalizeTaiwanPlaceName } from '../utils/locationFormatter.js';

const loadingMessages = [
  '正在讀取你的日記...',
  '正在整理情緒軌跡...',
  '正在分析地點與時間模式...',
  '正在生成 Adrift Intelligence 洞察...'
];

const previewFeatures = [
  {
    icon: <MapPin size={17} />,
    title: '地點洞察',
    copy: '找出哪些地方最常承載你的心情。'
  },
  {
    icon: <TrendingUp size={17} />,
    title: '情緒趨勢',
    copy: '整理最近的情緒變化與主要心情。'
  },
  {
    icon: <Compass size={17} />,
    title: '生活模式',
    copy: '觀察你常在什麼時間、地點留下記憶。'
  }
];

const emptyInsight = {
  summary: '',
  moodTrend: {
    description: '',
    dominantMood: '',
    averageIntensity: 0
  },
  locationInsights: [],
  behaviorPatterns: [],
  suggestions: []
};

export default function LifeMapAI({ state, onStateChange, onBack }) {
  const [loadingIndex, setLoadingIndex] = useState(0);
  const status = state?.status || 'idle';
  const insight = state?.insight || null;
  const dataWarmup = state?.dataWarmup || null;

  function updateLifeMapState(nextState) {
    onStateChange?.((current) => ({
      status: 'idle',
      insight: null,
      dataWarmup: null,
      ...(current || {}),
      ...nextState
    }));
  }

  useEffect(() => {
    if (status !== 'loading') return undefined;

    setLoadingIndex(0);
    const timer = window.setInterval(() => {
      setLoadingIndex((index) => (index + 1) % loadingMessages.length);
    }, 1200);

    return () => window.clearInterval(timer);
  }, [status]);

  async function generateInsight() {
    try {
      updateLifeMapState({ status: 'loading', insight: null, dataWarmup: null });
      setLoadingIndex(0);
      const payload = await api.getLifeMapInsight();
      const data = payload?.data || null;

      if (data?.notEnoughData) {
        updateLifeMapState({ status: 'notEnoughData', insight: null, dataWarmup: data });
        return;
      }

      if (!data || typeof data !== 'object') {
        updateLifeMapState({ status: 'error', insight: null, dataWarmup: null });
        return;
      }

      updateLifeMapState({ status: 'success', insight: normalizeInsight(data), dataWarmup: null });
    } catch {
      updateLifeMapState({ status: 'error', insight: null, dataWarmup: null });
    }
  }

  const isLoading = status === 'loading';
  const hasResult = status === 'success' && insight;

  return (
    <motion.main className="life-map-panel glass" {...pageFadeUp}>
      <section className="life-map-hero">
        <button className="icon-button life-map-back" type="button" onClick={onBack} aria-label="返回地圖">
          <ArrowLeft size={17} />
        </button>

        <div className="life-map-hero-copy">
          <p className="eyebrow">智慧洞察儀表板</p>
          <h1>Adrift Intelligence</h1>
          <p>讓 Adrift 讀懂你的情緒、地點與生活軌跡。</p>
          <span>根據你的日記、心情與位置，整理出專屬於你的生活洞察。</span>

          <div className="life-map-hero-actions">
            <button className="life-map-cta" type="button" onClick={generateInsight} disabled={isLoading}>
              {isLoading ? <span className="button-spinner dark" /> : <Sparkles size={17} />}
              {hasResult ? '重新產生洞察' : '產生智慧洞察'}
            </button>
            <button className="life-map-secondary-action" type="button" onClick={onBack}>
              回到地圖
            </button>
          </div>
        </div>

        <div className="life-map-visual" aria-hidden="true">
          <span className="life-map-glow-orb" />
          <span className="life-map-trace trace-one" />
          <span className="life-map-trace trace-two" />
          <span className="life-map-orbit-dot dot-one" />
          <span className="life-map-orbit-dot dot-two" />
          <span className="life-map-orbit-dot dot-three" />
        </div>
      </section>

      <section className="life-map-state-stage" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {status === 'idle' && (
            <motion.section className="life-map-prep-grid" key="idle" {...fadeUpMotion}>
              {previewFeatures.map((feature, index) => (
                <motion.article className="life-map-feature-card" key={feature.title} {...listItemMotion(index)}>
                  <div className="life-map-feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.copy}</p>
                </motion.article>
              ))}
            </motion.section>
          )}

          {status === 'loading' && (
            <motion.section className="life-map-loading-state" key="loading" {...fadeUpMotion}>
              <div className="life-map-loading-visual" aria-hidden="true">
                <span className="loading-node center" />
                <span className="loading-node node-a" />
                <span className="loading-node node-b" />
                <span className="loading-node node-c" />
                <span className="loading-path path-a" />
                <span className="loading-path path-b" />
              </div>
              <div>
                <h2>Adrift Intelligence 正在整理你的生活軌跡...</h2>
                <p>{loadingMessages[loadingIndex]}</p>
              </div>
            </motion.section>
          )}

          {status === 'notEnoughData' && (
            <motion.section className="life-map-empty-state" key="not-enough" {...fadeUpMotion}>
              <Target size={22} />
              <h2>資料還不夠完整</h2>
              <p>至少需要 {dataWarmup?.required || 3} 篇日記，才能產生 Adrift Intelligence 洞察。目前已有 {dataWarmup?.current || 0} 篇。</p>
              <button className="life-map-cta compact" type="button" onClick={onBack}>
                回到地圖新增日記
              </button>
            </motion.section>
          )}

          {status === 'error' && (
            <motion.section className="life-map-empty-state error" key="error" {...fadeUpMotion}>
              <Brain size={22} />
              <h2>Adrift Intelligence 暫時無法使用</h2>
              <p>請稍後再試一次。</p>
              <button className="life-map-cta compact" type="button" onClick={generateInsight}>
                <RefreshCw size={16} />
                重新嘗試
              </button>
            </motion.section>
          )}

          {hasResult && (
            <LifeMapDashboard key="result" insight={insight} onRegenerate={generateInsight} />
          )}
        </AnimatePresence>
      </section>

      <section className="life-map-privacy-card">
        <ShieldCheck size={17} />
        <p>Adrift Intelligence 只會根據你自己的日記產生洞察，不會分析其他使用者資料。分析結果僅供自我回顧參考，並非醫療或心理診斷。</p>
      </section>
    </motion.main>
  );
}

function LifeMapDashboard({ insight, onRegenerate }) {
  const safeInsight = normalizeInsight(insight);
  const averageIntensity = Number(safeInsight.moodTrend.averageIntensity || 0);

  return (
    <motion.section className="life-map-dashboard" {...fadeUpMotion}>
      <article className="life-map-summary-card">
        <div className="life-map-card-heading">
          <span><Sparkles size={17} /> 整體摘要</span>
          <button className="life-map-secondary-action compact" type="button" onClick={onRegenerate}>
            <RefreshCw size={15} />
            重新產生洞察
          </button>
        </div>
        <p>{safeInsight.summary || '目前沒有足夠摘要內容。'}</p>
      </article>

      <div className="life-map-dashboard-grid">
        <article className="life-map-insight-card mood">
          <div className="life-map-card-heading">
            <span><TrendingUp size={17} /> 情緒趨勢</span>
          </div>
          <p>{safeInsight.moodTrend.description || '目前沒有明確情緒趨勢。'}</p>
          <div className="life-map-mood-metrics">
            <span>主要心情：<strong>{safeInsight.moodTrend.dominantMood || '-'}</strong></span>
            <span>平均強度：<strong>{formatIntensity(averageIntensity)} / 5</strong></span>
          </div>
          <div className="life-map-progress" aria-label={`平均強度 ${formatIntensity(averageIntensity)} / 5`}>
            <span style={{ width: `${Math.min(100, Math.max(0, (averageIntensity / 5) * 100))}%` }} />
          </div>
        </article>

        <article className="life-map-insight-card suggestion">
          <div className="life-map-card-heading">
            <span><Lightbulb size={17} /> 智慧建議</span>
          </div>
          <div className="life-map-soft-list">
            {safeInsight.suggestions.length > 0 ? (
              safeInsight.suggestions.map((item, index) => <p key={`suggestion-${index}`}>{item}</p>)
            ) : (
              <p>可以先持續記錄幾天，讓 Adrift Intelligence 更懂你的生活節奏。</p>
            )}
          </div>
        </article>
      </div>

      <section className="life-map-wide-section">
        <div className="life-map-card-heading">
          <span><MapPin size={17} /> 地點洞察</span>
        </div>
        <div className="life-map-location-grid">
          {safeInsight.locationInsights.length > 0 ? (
            safeInsight.locationInsights.map((item, index) => (
              <motion.article className="life-map-location-card" key={`${item.place}-${index}`} {...listItemMotion(index)}>
                <strong>{normalizeTaiwanPlaceName(item.place) || '未命名地點'}</strong>
                <span>{normalizeTaiwanPlaceName(item.dominantMood) || '未分類心情'}</span>
                <p>{normalizeTaiwanPlaceName(item.insight) || '這個地點還需要更多日記，才能看出更清楚的模式。'}</p>
              </motion.article>
            ))
          ) : (
            <p className="life-map-muted">目前還沒有足夠的地點洞察。</p>
          )}
        </div>
      </section>

      <section className="life-map-wide-section">
        <div className="life-map-card-heading">
          <span><Compass size={17} /> 行為模式</span>
        </div>
        <div className="life-map-pattern-list">
          {safeInsight.behaviorPatterns.length > 0 ? (
            safeInsight.behaviorPatterns.map((item, index) => (
              <motion.p key={`pattern-${index}`} {...listItemMotion(index)}>
                {item}
              </motion.p>
            ))
          ) : (
            <p>持續記錄後，系統會整理出更清楚的時間與地點模式。</p>
          )}
        </div>
      </section>
    </motion.section>
  );
}

function normalizeInsight(value) {
  if (!value || typeof value !== 'object') return emptyInsight;

  const moodTrend = value.moodTrend && typeof value.moodTrend === 'object' ? value.moodTrend : {};

  return {
    summary: typeof value.summary === 'string' ? normalizeTaiwanPlaceName(value.summary) : '',
    moodTrend: {
      description: typeof moodTrend.description === 'string' ? normalizeTaiwanPlaceName(moodTrend.description) : '',
      dominantMood: typeof moodTrend.dominantMood === 'string' ? normalizeTaiwanPlaceName(moodTrend.dominantMood) : '',
      averageIntensity: Number.isFinite(Number(moodTrend.averageIntensity)) ? Number(moodTrend.averageIntensity) : 0
    },
    locationInsights: Array.isArray(value.locationInsights)
      ? value.locationInsights
          .filter(Boolean)
          .map((item) => ({
            ...item,
            place: normalizeTaiwanPlaceName(item.place || ''),
            insight: normalizeTaiwanPlaceName(item.insight || ''),
            dominantMood: normalizeTaiwanPlaceName(item.dominantMood || '')
          }))
      : [],
    behaviorPatterns: toStringList(value.behaviorPatterns),
    suggestions: toStringList(value.suggestions)
  };
}

function toStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => normalizeTaiwanPlaceName(item));
}

function formatIntensity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return number.toFixed(1);
}
