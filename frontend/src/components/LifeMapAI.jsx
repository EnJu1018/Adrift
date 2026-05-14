import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Lightbulb, MapPin, Sparkles, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/client.js';
import { fadeUpMotion, listItemMotion, panelSlideRight, toastMotion } from '../constants/animations.js';

export default function LifeMapAI({ onBack }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function generateInsight() {
    try {
      setLoading(true);
      setError('');
      setNotice('');
      const payload = await api.getLifeMapInsight();

      setInsight(payload.data || null);
      setNotice(payload.message || '');
    } catch (nextError) {
      setInsight(null);
      setError(nextError.message || 'AI 分析暫時無法使用，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  const notEnoughData = insight?.notEnoughData;

  return (
    <motion.aside
      className="life-map-panel glass"
      {...panelSlideRight}
    >
      <header className="life-map-header">
        <button className="icon-button" onClick={onBack} aria-label="返回日記">
          <ArrowLeft size={17} />
        </button>
        <div>
          <p className="eyebrow">Adrift AI</p>
          <h2>
            <span aria-hidden="true">🧠</span>
            Life Map AI
          </h2>
          <span>AI 會根據你的日記、地點與情緒，整理出你的生活模式。</span>
        </div>
      </header>

      <button className="primary-button life-map-generate" onClick={generateInsight} disabled={loading}>
        {loading ? <span className="button-spinner dark" /> : <Sparkles size={17} />}
        產生我的 Life Map
      </button>

      <AnimatePresence mode="popLayout">
        {loading && (
          <motion.div
            className="life-map-loading"
            {...fadeUpMotion}
          >
            <span className="ai-orbit" />
            <p>AI 正在分析你的生活地圖...</p>
          </motion.div>
        )}

        {error && (
          <motion.p
            className="form-message error"
            {...toastMotion}
          >
            {error}
          </motion.p>
        )}

        {!loading && notEnoughData && (
          <motion.section
            className="life-map-card"
            {...fadeUpMotion}
          >
            <p className="eyebrow">Data Warmup</p>
            <h3>日記數量不足</h3>
            <p>
              目前有 {insight.current} 則日記，至少需要 {insight.required} 則，才能產生比較完整的人生地圖洞察。
            </p>
          </motion.section>
        )}

        {!loading && insight && !notEnoughData && (
          <motion.div
            className="life-map-results"
            {...fadeUpMotion}
          >
            {notice && <p className="quiet-note">{notice}</p>}

            <InsightCard icon={<Sparkles size={17} />} title="整體摘要">
              <p>{insight.summary}</p>
            </InsightCard>

            <InsightCard icon={<TrendingUp size={17} />} title="情緒趨勢">
              <p>{insight.moodTrend?.description}</p>
              <div className="life-map-metrics">
                <span>主要情緒：{insight.moodTrend?.dominantMood || '-'}</span>
                <span>平均強度：{formatIntensity(insight.moodTrend?.averageIntensity)}</span>
              </div>
            </InsightCard>

            <InsightCard icon={<MapPin size={17} />} title="地點洞察">
              <div className="life-map-list">
                {(insight.locationInsights || []).map((item, index) => (
                  <article key={`${item.place}-${index}`}>
                    <strong>{item.place || '未命名地點'}</strong>
                    <p>{item.insight}</p>
                    <span>{item.dominantMood}</span>
                  </article>
                ))}
              </div>
            </InsightCard>

            <InsightCard icon={<Lightbulb size={17} />} title="AI 建議">
              <div className="life-map-list compact">
                {(insight.behaviorPatterns || []).map((item, index) => (
                  <p key={`pattern-${index}`}>{item}</p>
                ))}
                {(insight.suggestions || []).map((item, index) => (
                  <p key={`suggestion-${index}`}>{item}</p>
                ))}
              </div>
            </InsightCard>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="life-map-privacy">
        AI 分析僅根據你的日記內容產生，結果僅供自我回顧參考，並非醫療或心理診斷。
      </p>
    </motion.aside>
  );
}

function InsightCard({ icon, title, children }) {
  return (
    <motion.section className="life-map-card" {...listItemMotion(0, false)}>
      <div className="section-title">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </motion.section>
  );
}

function formatIntensity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return number.toFixed(1);
}
