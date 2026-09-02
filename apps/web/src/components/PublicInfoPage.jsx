import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Compass,
  HeartHandshake,
  LockKeyhole,
  MapPinned,
  Route,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import { pageFadeUp } from '../constants/animations.js';

const aboutFeatures = [
  ['地圖日記', '在真實地點留下文字、心情與生活片段。', <MapPinned size={22} />],
  ['情緒足跡', '用心情與強度記錄當下狀態，看見生活節奏。', <Sparkles size={22} />],
  ['好友記憶', '和好友分享特定記憶，也探索公開的城市故事。', <Users size={22} />],
  ['Adrift Intelligence', '根據日記、地點與情緒，整理個人化的回顧與洞察。', <Brain size={22} />]
];

const scenarios = [
  '旅行時，把某個海邊的心情留在地圖上。',
  '搬家後，回頭看自己曾經常去的地方。',
  '和朋友分享某些地點的回憶，而不是只丟一張照片。',
  '用一個月的日記回顧生活節奏與情緒變化。'
];

const comparisons = [
  ['Google Maps', '擅長導航、找地點與收藏店家，但不會記得你在那裡的心情。', <Compass size={22} />],
  ['Instagram', '擅長照片、限動與即時社群互動，但記憶容易被演算法往下推走。', <HeartHandshake size={22} />],
  ['一般日記 App', '擅長寫文字，卻少了地點脈絡，也不容易看見城市中的生活節點。', <BookOpen size={22} />],
  ['Adrift', '把地點、記憶、情緒與人際關係放在一起，讓城市成為能回看的記憶地圖。', <MapPinned size={22} />]
];

const privacyCards = [
  ['私人日記', '只有你自己能看見，適合保留純粹的個人回顧。', <LockKeyhole size={22} />],
  ['好友可見', '只分享給你信任的人，讓社交更有邊界。', <Users size={22} />],
  ['公開記憶', '讓城市裡的其他人遇見故事，但每篇日記的可見範圍由你決定。', <ShieldCheck size={22} />]
];

const privacyPrinciples = [
  '私人日記不會被公開顯示。',
  '每篇日記都能選擇私人、好友或公開。',
  '地點資料用來建立記憶地圖與回顧脈絡。',
  'Adrift Intelligence 只根據你的日記資料產生回顧與洞察。'
];

export default function PublicInfoPage({ type = 'about', onNavigate }) {
  const isPrivacyPage = type === 'privacy';

  return (
    <motion.section className="public-info-page" {...pageFadeUp}>
      <header className="landing-nav public-info-nav">
        <button className="landing-brand" type="button" onClick={() => onNavigate('/')}>
          <img src="/adrift-icon.png" alt="" aria-hidden="true" />
          <span>Adrift</span>
        </button>
        <button className="landing-nav-login" type="button" onClick={() => onNavigate('/')}>
          <ArrowLeft size={16} />
          回首頁
        </button>
      </header>

      {isPrivacyPage ? <PrivacyContent onNavigate={onNavigate} /> : <AboutContent onNavigate={onNavigate} />}
    </motion.section>
  );
}

function AboutContent({ onNavigate }) {
  return (
    <main className="public-info-main public-info-main-wide">
      <section className="public-info-hero">
        <p className="eyebrow">About Adrift</p>
        <h1>什麼是 Adrift 漂流足跡？</h1>
        <p>
          Adrift 漂流足跡是一個以地圖為核心的生活記錄與城市記憶平台。使用者可以在去過的地點留下日記、照片與情緒，並與好友建立共同的城市記憶。
        </p>
      </section>

      <section className="public-info-section public-info-note">
        <MapPinned size={24} />
        <div>
          <p className="eyebrow">City Memory System</p>
          <h2>漂流足跡不是單純在地圖上發東西。</h2>
          <p>
            Adrift 的核心是讓「地點 → 當下發生的事情 → 情緒 → 人」逐漸累積。幾個月、幾年後，這張地圖會慢慢變成你的生活，讓每個地方都有能被重新遇見的故事。
          </p>
        </div>
      </section>

      <section className="public-info-section">
        <div className="public-info-section-heading">
          <p className="eyebrow">What You Can Do</p>
          <h2>你可以在 Adrift 做什麼？</h2>
        </div>
        <div className="public-info-grid four">
          {aboutFeatures.map(([title, text, icon]) => (
            <article className="landing-feature-card" key={title}>
              {icon}
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-info-section public-info-scenarios">
        <div className="public-info-section-heading">
          <p className="eyebrow">Use Cases</p>
          <h2>實際使用情境</h2>
          <p>Adrift 適合想記錄生活、旅行、通勤、校園與城市回憶的人，也適合想用地圖回顧情緒節奏的使用者。</p>
        </div>
        <div className="public-info-scenario-list">
          {scenarios.map((text, index) => (
            <article key={text}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-info-section">
        <div className="public-info-section-heading">
          <p className="eyebrow">Difference</p>
          <h2>Google Maps 記得路線，IG 記得照片。Adrift 記得你在某個地方的心情與故事。</h2>
          <p>
            Adrift 不是另一個普通地圖或社群網站。它的核心，是把「地點 × 記憶 × 情緒 × 人際關係」放在一起，讓每個地方成為可以回看的生活節點。
          </p>
        </div>
        <div className="public-info-compare-list">
          {comparisons.map(([title, text, icon]) => (
            <article className={title === 'Adrift' ? 'is-adrift' : ''} key={title}>
              {icon}
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-info-section public-info-note">
        <Route size={24} />
        <div>
          <p className="eyebrow">Single-player First</p>
          <h2>即使只有自己使用，也有價值。</h2>
          <p>
            Adrift 不需要一開始就有很多朋友或很多公開內容。你可以先把它當成自己的記憶地圖：記錄每天去過的地方、當下的心情，以及那些只有自己知道的生活片段。當日記累積起來，城市會慢慢變成屬於你的回憶地圖。
          </p>
        </div>
      </section>

      <section className="public-info-section">
        <div className="public-info-section-heading">
          <p className="eyebrow">Privacy by Design</p>
          <h2>不是每一段記憶都需要公開。</h2>
          <p>
            每篇日記都可以選擇私人、好友可見或公開可見。你可以把 Adrift 當成自己的私密地圖，也可以選擇讓某些故事被朋友或城市裡的人遇見。
          </p>
        </div>
        <div className="public-info-grid">
          {privacyCards.map(([title, text, icon]) => (
            <article className="landing-feature-card" key={title}>
              {icon}
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="public-info-actions">
        <button className="primary-button" type="button" onClick={() => onNavigate('/register')}>
          開始漂流
        </button>
        <button className="landing-secondary-action as-button" type="button" onClick={() => onNavigate('/privacy')}>
          了解隱私設計
        </button>
      </div>
    </main>
  );
}

function PrivacyContent({ onNavigate }) {
  return (
    <main className="public-info-main public-info-main-wide">
      <section className="public-info-hero">
        <p className="eyebrow">Privacy by Design</p>
        <h1>你的足跡，由你決定誰能看見。</h1>
        <p>
          Adrift 使用地點承載記憶，所以隱私不是附加條款，而是產品設計的一部分。你可以控制日記的可見範圍，讓私人回憶、好友分享與公開故事有清楚邊界。
        </p>
      </section>

      <section className="public-info-section">
        <div className="public-info-grid">
          {privacyCards.map(([title, text, icon]) => (
            <article className="landing-feature-card" key={title}>
              {icon}
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-info-section public-info-scenarios">
        <div className="public-info-section-heading">
          <p className="eyebrow">How Data Is Used</p>
          <h2>地點資料是為了記憶脈絡，而不是暴露即時位置。</h2>
          <p>
            Adrift 讓你在地圖上回顧生活片段，但不要求你把每段記憶都公開。公開、好友與私人範圍會影響其他使用者是否能在地圖或動態中看到該篇日記。
          </p>
        </div>
        <div className="public-info-principles">
          {privacyPrinciples.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      </section>

      <section className="public-info-section public-info-note">
        <Brain size={24} />
        <div>
          <p className="eyebrow">Adrift Intelligence</p>
          <h2>智慧洞察只應用在回顧與整理。</h2>
          <p>
            Adrift Intelligence 使用你的日記、地點與情緒資料整理個人化回顧。分析結果僅供自我回顧參考，不是醫療或心理診斷，也不會拿私人日記去製造公開內容。
          </p>
        </div>
      </section>

      <div className="public-info-actions">
        <button className="primary-button" type="button" onClick={() => onNavigate('/register')}>
          開始漂流
        </button>
        <button className="landing-secondary-action as-button" type="button" onClick={() => onNavigate('/about')}>
          認識 Adrift
        </button>
      </div>
    </main>
  );
}
