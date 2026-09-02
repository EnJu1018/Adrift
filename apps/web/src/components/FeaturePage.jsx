import { motion } from 'framer-motion';
import { ArrowLeft, Brain, Clock3, HeartPulse, MapPinned, Route, Sparkles, Users } from 'lucide-react';
import { pageFadeUp } from '../constants/animations.js';

const featureContent = {
  'map-diary': {
    eyebrow: 'Feature',
    title: '地圖日記',
    summary:
      '地圖日記讓你把生活片段留在真實發生的地方。每一篇日記都包含地點、時間、心情與故事，讓回憶不只存在於列表裡，而是回到城市地圖上。',
    icon: <MapPinned size={28} />,
    points: [
      ['真實地點', '把日記放回事情發生的位置，讓記憶有清楚的地點脈絡。'],
      ['時間回顧', '幾個月或幾年後再次經過同一個地方，可以重新遇見當時的自己。'],
      ['可見性控制', '每篇日記都能選擇私人、好友或公開，讓分享有清楚邊界。']
    ],
    scene: '例如你在學校附近寫下一篇日記，之後回到同一條街，Adrift 會把那段生活片段重新帶回地圖上。',
    seoCopy:
      '地圖日記不是打卡清單。它把地點、時間、心情與文字放在一起，讓每個座標都能成為之後可以重新閱讀的城市記憶。'
  },
  emotion: {
    eyebrow: 'Feature',
    title: '情緒足跡',
    summary:
      '情緒足跡讓你記錄每個地點當下的心情與強度。當紀錄累積後，你可以看見自己在不同時間、不同地點的生活節奏與情緒變化。',
    icon: <HeartPulse size={28} />,
    points: [
      ['心情與強度', '不只寫下事件，也記錄當下的情緒狀態與強弱。'],
      ['生活節奏', '把分散的日記連成情緒軌跡，看見自己在哪些地方感到安定或疲憊。'],
      ['自我回顧', '情緒資料是為了幫助回顧，不是評分，也不是心理診斷。']
    ],
    scene: '當你連續幾週記錄心情，Adrift 可以幫你看見哪些地點、時段或生活事件常和特定情緒一起出現。',
    seoCopy:
      '情緒足跡讓日記不只記錄發生了什麼，也記錄當時的感受。累積之後，使用者能從地圖上回顧自己的情緒節奏。'
  },
  memories: {
    eyebrow: 'Feature',
    title: '城市記憶',
    summary:
      '城市記憶是 Adrift 的核心概念。隨著日記累積，地圖不再只是道路與地標，而會慢慢變成屬於你和朋友的生活記憶系統。',
    icon: <Sparkles size={28} />,
    points: [
      ['自己的記憶地圖', '即使只有自己使用，也能累積可回看的生活軌跡。'],
      ['好友共同回憶', '和朋友在同一座城市留下彼此的故事，讓地點變得更有人味。'],
      ['Adrift Intelligence', '當資料累積後，智慧洞察會整理生活回顧、情緒趨勢與地點洞察。']
    ],
    scene: '一開始地圖可能很安靜，但每一篇日記都會讓城市多一個記憶節點。久了以後，這張地圖會變成你的生活。',
    seoCopy:
      '城市記憶把自己的日記、好友互動與公開故事放在同一張地圖上。它先服務個人回顧，再讓社交內容慢慢變得有脈絡。'
  }
};

export default function FeaturePage({ slug = 'map-diary', onNavigate }) {
  const feature = featureContent[slug] || featureContent['map-diary'];

  return (
    <motion.section className="public-info-page feature-page" {...pageFadeUp}>
      <header className="landing-nav public-info-nav">
        <button className="landing-brand" type="button" onClick={() => onNavigate('/')}>
          <img src="/adrift-icon.png" alt="" aria-hidden="true" />
          <span>Adrift</span>
        </button>
        <button className="landing-nav-login" type="button" onClick={() => onNavigate('/about')}>
          <ArrowLeft size={16} />
          回到關於
        </button>
      </header>

      <main className="public-info-main public-info-main-wide feature-main">
        <section className="feature-hero">
          <div className="feature-hero-icon">{feature.icon}</div>
          <div>
            <p className="eyebrow">{feature.eyebrow}</p>
            <h1>{feature.title}</h1>
            <p>{feature.summary}</p>
          </div>
        </section>

        <section className="public-info-section feature-definition">
          <p>
            Adrift 漂流足跡是一個以地圖為核心的生活記錄與城市記憶平台。使用者可以在去過的地點留下日記、照片與情緒，並與好友建立共同的城市記憶。
          </p>
          <p>{feature.seoCopy}</p>
        </section>

        <section className="public-info-section">
          <div className="public-info-grid">
            {feature.points.map(([title, text]) => (
              <article className="landing-feature-card" key={title}>
                <Route size={22} />
                <h2>{title}</h2>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-info-section public-info-note">
          <Clock3 size={24} />
          <div>
            <p className="eyebrow">How It Feels</p>
            <h2>幾個月、幾年後，這張地圖會變成你的生活。</h2>
            <p>{feature.scene}</p>
          </div>
        </section>

        <section className="public-info-section public-info-note">
          <Brain size={24} />
          <div>
            <p className="eyebrow">Adrift Intelligence</p>
            <h2>智慧洞察是整理記憶的工具，不是主角。</h2>
            <p>
              當日記慢慢累積，Adrift Intelligence 會根據你的地點、情緒與文字，整理生活回顧、情緒趨勢與地點洞察，幫你重新連起那些散落在城市裡的片段。
            </p>
          </div>
        </section>

        <div className="public-info-actions">
          <button className="primary-button" type="button" onClick={() => onNavigate('/register')}>
            開始漂流
          </button>
          <button className="landing-secondary-action as-button" type="button" onClick={() => onNavigate('/about')}>
            了解完整概念
          </button>
        </div>
      </main>
    </motion.section>
  );
}
