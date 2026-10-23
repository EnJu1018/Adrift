import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';
import { PUBLIC_SEO, updatePublicSeo } from '../lib/publicSeo.js';
import './mobileGate.css';

const productNotes = [
  ['地圖日記', '把生活片段留在真實發生的地方，記錄地點、時間、照片與故事，讓每個座標成為可以回看的記憶節點。'],
  ['情緒足跡', '記錄當下的心情與強度，回顧不同時間與地點的生活節奏。情緒紀錄用於自我回顧，不是心理診斷。'],
  ['好友記憶', '和好友分享特定記憶，也探索公開的城市故事。即使只有自己使用，每篇日記也會慢慢累積成自己的城市記憶。'],
  ['Adrift Intelligence', '根據你的日記、地點與情緒，整理個人化的生活回顧、情緒趨勢與地點洞察。']
];
const privacyNotes = [
  ['私人日記', '只有你自己能看見，適合保留純粹的個人回顧。'],
  ['好友可見', '只分享給你信任的人，讓社交更有邊界。'],
  ['公開記憶', '讓城市裡的其他人遇見故事，但每篇日記的可見範圍由你決定。'],
  ['地點與智慧洞察', '地點資料用來建立記憶地圖與回顧脈絡。Adrift Intelligence 根據你的日記資料整理洞察，僅供自我回顧參考，不是醫療或心理診斷，也不會拿私人日記製造公開內容。']
];

export default function MobileGate() {
  const [path, setPath] = useState(() => window.location.pathname);
  const normalizedPath = path.replace(/\/$/, '') || '/';
  const seo = PUBLIC_SEO[normalizedPath];

  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const previous = themeMeta?.content;
    if (themeMeta) themeMeta.content = '#070b12';
    return () => {
      window.removeEventListener('popstate', sync);
      if (themeMeta) themeMeta.content = previous;
    };
  }, []);

  useEffect(() => { updatePublicSeo(path); }, [path]);

  return (
    <main className="mobile-gate">
      <section className="mg-hero" aria-labelledby="mobile-gate-title">
        <svg className="mg-map" viewBox="0 0 680 960" fill="none" aria-hidden="true" focusable="false">
          <g className="mg-streets">
            <path d="M-80 260C90 120 210 235 340 120S580 60 740 150M-30 310C110 180 230 290 365 170S590 115 720 200M-40 755C120 690 230 820 400 720S590 700 720 610M-30 810C130 740 245 870 420 770S600 750 730 665" />
            <path d="M60-40C210 95 130 255 190 400S100 700 200 1000M540-30C430 180 580 310 510 500S580 800 455 1000" />
            <path d="M-40 495C90 420 220 530 350 465S560 370 720 445M-30 545C110 470 230 580 375 510S570 420 720 490" />
          </g>
          <path className="mg-trail" d="M-20 755C120 690 230 820 400 720S590 700 720 610" />
          <g className="mg-node" transform="translate(188 746)"><circle className="mg-halo" r="13" /><circle r="3" /></g>
          <g className="mg-node mg-node-secondary" transform="translate(505 686)"><circle className="mg-halo" r="11" /><circle r="2.5" /></g>
        </svg>

        <div className="mg-content">
          <div className="mg-brand">
            <img src="/icon-192.png" width="60" height="60" alt="" />
            <span>Adrift</span>
          </div>
          <p className="mg-brand-name">漂流足跡</p>
          <div className="mg-heading">
            <h1 id="mobile-gate-title">App 開發中</h1>
            <p className="mg-apology">敬請見諒</p>
          </div>
          <p className="mg-description"><span>目前 Adrift 網頁版僅開放桌面裝置使用。</span><span>手機版 App 正在開發中，敬請期待。</span></p>
          <p className="mg-desktop-note"><Monitor size={18} aria-hidden="true" /><span>請使用電腦瀏覽器開啟 Adrift。</span></p>
        </div>
        {seo && <a className="mg-read-more" href="#product-information">關於 Adrift <span aria-hidden="true">↓</span></a>}
      </section>

      {seo && (
        <section className="mg-information" id="product-information" aria-labelledby="mg-information-title">
          <p className="mg-section-label">地圖日記與城市記憶平台</p>
          <h2 id="mg-information-title">{normalizedPath === '/' ? '把生活，留在發生的地方。' : seo.title.split('｜')[0]}</h2>
          <p>{seo.description}</p>
          {normalizedPath !== '/privacy' && <>
            <p>Adrift 的核心價值，是讓使用者把生活記憶留在真實發生的地點。幾個月或幾年後，地圖不再只是地圖，而會慢慢變成屬於你的城市記憶。</p>
            <p>Google Maps 記得你去過哪裡，IG 記得你拍過什麼，Adrift 記得你在某個地方發生了什麼、感覺如何、和誰有關。</p>
          </>}
          <dl>
            {(normalizedPath === '/privacy' ? privacyNotes : productNotes).map(([title, description]) => (
              <div key={title}><dt>{title}</dt><dd>{description}</dd></div>
            ))}
          </dl>
          {normalizedPath !== '/privacy' && <p>不是每一段記憶都需要公開。每篇日記都能選擇私人、好友或公開；私人日記只有自己看得到，好友日記只與信任的人分享。</p>}
          <nav aria-label="產品資訊">
            <a href="/about">關於 Adrift</a>
            <a href="/features/map-diary">地圖日記</a>
            <a href="/features/emotion">情緒足跡</a>
            <a href="/features/memories">城市記憶</a>
            <a href="/privacy">隱私設計</a>
          </nav>
        </section>
      )}
    </main>
  );
}
