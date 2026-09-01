import { motion } from 'framer-motion';
import { ArrowLeft, Brain, LockKeyhole, MapPinned, ShieldCheck, Users } from 'lucide-react';
import { pageFadeUp } from '../constants/animations.js';

const pageContent = {
  about: {
    eyebrow: 'About Adrift',
    title: 'Adrift 是把地點、心情與生活片段重新連在一起的地圖日記。',
    intro: '它不是單純的日記，也不是公開曝光式社群。Adrift 關注的是你在某個地方留下的情緒、故事與時間。',
    cards: [
      ['地圖日記', '每篇日記都回到真實地點，讓回顧不只是時間軸。', <MapPinned size={22} />],
      ['情緒足跡', '記錄心情與強度，讓生活節奏能被看見。', <Brain size={22} />],
      ['好友記憶', '用好友與公開記憶補上城市裡人的故事。', <Users size={22} />]
    ]
  },
  privacy: {
    eyebrow: 'Privacy by Design',
    title: '你的足跡，由你決定誰能看見。',
    intro: 'Adrift 使用地點承載記憶，所以隱私不是附加條款，而是產品設計的一部分。',
    cards: [
      ['私人日記', '只有你自己能看見，適合保留純粹的個人回顧。', <LockKeyhole size={22} />],
      ['好友可見', '只分享給你信任的人，讓社交更有邊界。', <Users size={22} />],
      ['公開記憶', '讓城市裡的其他人遇見故事，但可見範圍由你決定。', <ShieldCheck size={22} />]
    ]
  }
};

export default function PublicInfoPage({ type = 'about', onNavigate }) {
  const content = pageContent[type] || pageContent.about;

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

      <main className="public-info-main">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.intro}</p>

        <div className="public-info-grid">
          {content.cards.map(([title, text, icon]) => (
            <article className="landing-feature-card" key={title}>
              {icon}
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>

        <div className="public-info-actions">
          <button className="primary-button" type="button" onClick={() => onNavigate('/register')}>
            開始漂流
          </button>
          <button className="landing-secondary-action as-button" type="button" onClick={() => onNavigate('/login')}>
            已有帳號，登入
          </button>
        </div>
      </main>
    </motion.section>
  );
}
