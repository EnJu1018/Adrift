import { motion } from 'framer-motion';
import { Brain, Compass, LockKeyhole, MapPinned, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { pageFadeUp } from '../constants/animations.js';

const productHighlights = [
  {
    icon: <MapPinned size={24} />,
    title: '地圖日記',
    text: '把生活片段留在真實地點，日後能用地圖重新回顧。'
  },
  {
    icon: <Sparkles size={24} />,
    title: '情緒足跡',
    text: '每篇日記都能記錄心情與強度，看見自己的生活節奏。'
  },
  {
    icon: <Users size={24} />,
    title: '好友記憶',
    text: '探索好友與公開記憶，讓城市不只是地圖，而是人的故事。'
  }
];

const privacyModes = [
  ['私人可見', '只留給自己回顧。'],
  ['好友可見', '只與信任的人分享。'],
  ['公開可見', '讓城市裡的其他人遇見你的故事。']
];

export default function LandingPage({ onNavigate }) {
  return (
    <motion.section className="landing-page" {...pageFadeUp}>
      <header className="landing-nav">
        <button className="landing-brand" type="button" onClick={() => onNavigate('/')}>
          <img src="/adrift-icon.png" alt="" aria-hidden="true" />
          <span>Adrift</span>
        </button>
        <nav aria-label="首頁導覽">
          <button type="button" onClick={() => onNavigate('/about')}>關於</button>
          <button type="button" onClick={() => onNavigate('/privacy')}>隱私</button>
          <button className="landing-nav-login" type="button" onClick={() => onNavigate('/login')}>登入</button>
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="eyebrow">Adrift 漂流足跡</p>
            <h1>把日記留在地圖上，讓每個地點都有你的生活記憶。</h1>
            <p>
              記錄地點、心情與故事，讓生活軌跡不只是打卡，而是可以被回顧、被重新遇見的記憶地圖。
            </p>
            <div className="landing-actions">
              <button className="primary-button" type="button" onClick={() => onNavigate('/register')}>
                開始漂流
              </button>
              <a className="landing-secondary-action" href="#how-it-works">
                看看它怎麼運作
              </a>
            </div>
          </div>

          <div className="landing-map-visual" aria-hidden="true">
            <svg viewBox="0 0 520 460" role="img">
              <defs>
                <linearGradient id="landingPathGradient" x1="70" y1="320" x2="460" y2="120" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--accent)" stopOpacity="0.85" />
                  <stop offset="1" stopColor="var(--tech-mint, #14b8a6)" stopOpacity="0.72" />
                </linearGradient>
              </defs>
              <path className="landing-contour-line" d="M46 280 C118 240 116 154 206 132 S340 124 412 64" />
              <path className="landing-contour-line soft" d="M62 360 C146 312 184 374 266 302 S392 224 470 252" />
              <path className="landing-contour-line soft" d="M58 118 C142 90 156 54 232 78 S332 154 448 116" />
              <path className="landing-memory-path" d="M82 330 C142 238 208 292 258 202 S390 112 452 218" />
              {[
                [82, 330, 9],
                [258, 202, 12],
                [452, 218, 10],
                [176, 262, 7]
              ].map(([cx, cy, r]) => (
                <g className="landing-memory-node" key={`${cx}-${cy}`} transform={`translate(${cx} ${cy})`}>
                  <circle className="landing-memory-halo" r={r * 3.2} />
                  <circle className="landing-memory-core" r={r} />
                </g>
              ))}
            </svg>
          </div>
        </section>

        <section id="how-it-works" className="landing-section">
          <div className="landing-section-heading">
            <p className="eyebrow">What Adrift Does</p>
            <h2>它能做什麼</h2>
          </div>
          <div className="landing-feature-grid">
            {productHighlights.map((item) => (
              <article className="landing-feature-card" key={item.title}>
                {item.icon}
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-difference">
          <div>
            <p className="eyebrow">Positioning</p>
            <h2>不是打卡，也不只是地圖。</h2>
            <p>
              Google Maps 記得路線，IG 記得照片。Adrift 記得你在某個地方的心情與故事。
            </p>
          </div>
          <div className="landing-compare-grid">
            <article>
              <Compass size={20} />
              <strong>Google Maps</strong>
              <span>擅長找地點、導航、收藏店家。</span>
            </article>
            <article>
              <Users size={20} />
              <strong>IG</strong>
              <span>擅長分享照片、限動與社群互動。</span>
            </article>
            <article className="is-adrift">
              <MapPinned size={20} />
              <strong>Adrift</strong>
              <span>把日記放回真實地點，讓城市成為可以回看的記憶節點。</span>
            </article>
          </div>
        </section>

        <section className="landing-two-column">
          <article className="landing-callout-card">
            <Brain size={24} />
            <h2>一個人使用，也會慢慢長出價值。</h2>
            <p>
              你的記憶地圖會隨著每篇日記成形。即使只有自己可見，也能在未來回顧生活軌跡、情緒變化與重要地點。
            </p>
          </article>

          <article className="landing-callout-card">
            <ShieldCheck size={24} />
            <h2>你的足跡，由你決定誰能看見。</h2>
            <p>Adrift 讓你記錄地點，但不要求你暴露即時位置。</p>
            <div className="landing-privacy-list">
              {privacyModes.map(([title, text]) => (
                <span key={title}>
                  <LockKeyhole size={15} />
                  <strong>{title}</strong>
                  {text}
                </span>
              ))}
            </div>
          </article>
        </section>
      </main>
    </motion.section>
  );
}
