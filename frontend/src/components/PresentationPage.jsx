import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Code2,
  Compass,
  Heart,
  KeyRound,
  Layers3,
  Lock,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Server,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { listItemMotion, pageFadeUp } from '../constants/animations.js';

const slides = [
  { id: 'cover', label: '封面', group: '封面' },
  { id: 'motivation', label: '專題動機', group: '專題概念' },
  { id: 'problem', label: '問題分析', group: '專題概念' },
  { id: 'goal', label: '專案目標', group: '專題概念' },
  { id: 'overview', label: '系統總覽', group: '系統功能' },
  { id: 'map-diary', label: '地圖日記', group: '系統功能' },
  { id: 'friends', label: '好友社交', group: '系統功能' },
  { id: 'authenticity', label: '真實性限制', group: '系統功能' },
  { id: 'life-map-ai', label: 'Adrift Intelligence', group: '系統功能' },
  { id: 'user-flow', label: '使用者流程', group: '系統架構' },
  { id: 'architecture', label: '系統架構', group: '系統架構' },
  { id: 'frontend-tech', label: '前端技術', group: '系統架構' },
  { id: 'backend-tech', label: '後端技術', group: '系統架構' },
  { id: 'ux', label: 'UX 設計', group: '設計亮點' },
  { id: 'difference', label: '差異化', group: '設計亮點' },
  { id: 'admin-role', label: '權限管理', group: '設計亮點' },
  { id: 'future', label: '未來展望', group: '設計亮點' },
  { id: 'team', label: '分工表', group: '成果展示' },
  { id: 'demo', label: 'Demo', group: '成果展示' },
  { id: 'thank-you', label: 'Thank You', group: '成果展示' }
];

const navGroups = [...new Map(slides.map((slide) => [slide.group, slide])).entries()].map(([label, firstSlide]) => ({
  label,
  firstSlideId: firstSlide.id
}));

const memberList = [
  ['張惠芯', '411200536'],
  ['洪藝文', '411203217'],
  ['王浩宇', '411252575'],
  ['陳恩儒', '411211383']
];

const problemCards = [
  ['缺少地點脈絡', '多數日記只記錄文字，無法直接連結真實地點。', <MapPin size={22} />],
  ['真實性不足', '內容可隨時修改，較難保留當下的原始情境。', <ShieldCheck size={22} />],
  ['互動性有限', '傳統日記偏向個人紀錄，好友間的共鳴與分享較少。', <MessageCircle size={22} />]
];

const goalCards = [
  ['地點化', '讓日記與真實地點連結。', <MapIcon size={24} />],
  ['情緒化', '讓每篇日記記錄當下心情。', <Heart size={24} />],
  ['社交化', '讓使用者選擇私密、好友或公開分享。', <Users size={24} />]
];

const overviewCards = [
  ['帳號管理', 'JWT 驗證、密碼加密、個人資料與 userCode。', <KeyRound size={22} />],
  ['日記管理', '地圖新增、編輯、刪除與心情紀錄。', <MapPin size={22} />],
  ['好友關係', '搜尋、邀請、好友限定日記與共鳴互動。', <Users size={22} />],
  ['Adrift Intelligence', '整理情緒、時間、地點與生活模式。', <Brain size={22} />]
];

const mapDiaryCards = [
  ['地圖作為主介面', '日記直接落在真實地點，讓回憶有位置。', <MapIcon size={22} />],
  ['日記 Marker', '心情與可見性會反映在地圖與列表上。', <MapPin size={22} />],
  ['定位新增日記', '使用目前位置建立日記，支援精確或大略定位。', <Compass size={22} />],
  ['即時更新', '新增、編輯、刪除後 marker 與列表立即同步。', <Sparkles size={22} />]
];

const socialCards = [
  ['userCode 搜尋', '使用公開 ID 找到朋友，不需要暴露 email。', <KeyRound size={22} />],
  ['好友邀請', '發送、接受、拒絕與收回邀請都能即時更新。', <Users size={22} />],
  ['好友限定日記', 'friends 權限只開放給好友觀看。', <Lock size={22} />],
  ['共鳴互動', '用輕量 reaction 表達理解，而不是製造留言壓力。', <Heart size={22} />]
];

const authenticityCards = [
  ['1 小時內', '發布後短時間內可修正內容。', <CheckCircle2 size={22} />],
  ['1 公里內', '仍接近原本地點才可編輯。', <MapPin size={22} />],
  ['不可改位置', '建立時間與座標保留為真實核心。', <ShieldCheck size={22} />],
  ['保留版本', 'editHistory 保存編輯前內容。', <Layers3 size={22} />]
];

const aiFeatureCards = [
  ['整體摘要', '整理一段時間內的生活軌跡。', <Sparkles size={22} />],
  ['情緒趨勢', '辨識主要 mood 與平均強度。', <Heart size={22} />],
  ['地點洞察', '找出常承載特定心情的地點。', <MapPin size={22} />],
  ['智慧建議', '用溫和語氣提供自我回顧方向。', <Brain size={22} />]
];

const frontendTech = [
  ['React', '組成地圖頁、好友頁、Adrift Intelligence 儀表板與簡報頁。'],
  ['Vite', '快速開發與前端打包部署。'],
  ['Mapbox GL JS', '地圖互動、定位、marker 與附近探索。'],
  ['Framer Motion', '頁面過渡、卡片進場與簡報動畫。'],
  ['CSS', '深色 玻璃擬態、響應式與投影字級。']
];

const backendTech = [
  ['Node.js / Express', '提供 REST API 與核心商業邏輯。'],
  ['MongoDB Atlas / Mongoose', '儲存使用者、日記、好友關係與互動。'],
  ['JWT / bcrypt', '負責登入驗證與密碼安全。'],
  ['GeoJSON / 2dsphere', '支援地點查詢與附近公開日記。'],
  ['Gemini API', '產生 Adrift Intelligence 生活洞察。']
];

const userFlowCoreBranches = [
  {
    title: '帳號流程',
    items: [
      { title: '註冊帳號', leaves: ['名稱 / Email', '使用者 ID / 密碼', '完成註冊'] },
      { title: '登入帳號' },
      { title: '帳號設定', leaves: ['修改名稱 / Email', '修改密碼', '刪除帳號'] }
    ]
  },
  {
    title: '地圖日記流程',
    items: [
      { title: '進入地圖頁' },
      { title: '取得目前位置', leaves: ['GPS 精確定位', 'IP 大略定位'] },
      { title: '新增日記', leaves: ['標題 / 內容', '心情 / 可見性', '發布日記'] },
      { title: '查看日記', leaves: ['地圖 marker', '左側詳情', '右側列表'] },
      { title: '刪除日記', leaves: ['確認視窗', '確認刪除'] }
    ]
  },
  {
    title: '編輯真實性限制',
    items: [
      { title: '編輯日記' },
      { title: '時間限制', leaves: ['發布後 1 小時內'] },
      { title: '距離限制', leaves: ['距離原位置 1 公里內'] },
      { title: '儲存變更', leaves: ['更新內容', '位置不可修改'] }
    ]
  }
];

const userFlowSocialAiBranches = [
  {
    title: '好友社交流程',
    items: [
      { title: '進入好友頁' },
      { title: '搜尋使用者 ID' },
      { title: '好友邀請', leaves: ['發送 / 收回', '接受 / 拒絕'] },
      { title: '好友資料', leaves: ['查看資料', '刪除好友', '好友限定日記'] }
    ]
  },
  {
    title: '動態探索流程',
    items: [
      { title: '進入動態頁' },
      { title: '查看內容', leaves: ['好友日記', '公開日記'] },
      { title: '切換篩選' },
      { title: '點擊日記查看詳情' }
    ]
  },
  {
    title: '共鳴互動流程',
    items: [
      { title: '查看日記' },
      { title: '點擊共鳴按鈕' },
      { title: '更新共鳴數量' },
      { title: '再次點擊取消共鳴' }
    ]
  },
  {
    title: 'Adrift Intelligence 流程',
    items: [
      { title: '進入 Adrift Intelligence' },
      { title: '檢查日記數量', leaves: ['少於 3 篇', '足夠資料'] },
      { title: 'Adrift Intelligence 整理日記資料' },
      { title: '產生洞察', leaves: ['情緒趨勢 / 地點洞察', '行為模式 / 智慧建議'] }
    ]
  }
];

const userFlowBranches = [
  {
    title: '帳號',
    subtitle: '註冊、登入與個人設定',
    items: ['建立使用者 ID', '登入 Adrift', '管理帳號']
  },
  {
    title: '地圖日記',
    subtitle: '定位後在真實地點留下記憶',
    items: ['取得位置', '新增日記', '查看 marker']
  },
  {
    title: '好友社交',
    subtitle: '透過 userCode 建立好友關係',
    items: ['搜尋好友', '處理邀請', '好友限定日記']
  },
  {
    title: '動態共鳴',
    subtitle: '瀏覽公開與好友日記並互動',
    items: ['進入動態', '切換篩選', '共鳴 / 取消']
  },
  {
    title: 'Adrift Intelligence',
    subtitle: '把日記整理成生活洞察',
    items: ['檢查日記數量', '產生智慧洞察', '產生建議']
  }
];

const systemTreeCoreModules = [
  {
    title: '帳號管理',
    tone: 'cyan',
    items: [
      { title: '註冊 / 登入', leaves: ['JWT 驗證', '密碼加密'] },
      { title: '使用者 ID' },
      { title: '個人資料', leaves: ['修改 / 刪除帳號'] }
    ]
  },
  {
    title: '地圖日記',
    tone: 'blue',
    items: [
      { title: '日記 CRUD', leaves: ['新增 / 查看', '編輯 / 刪除'] },
      { title: '日記內容', leaves: ['心情標籤 / 圖片上傳'] },
      { title: '可見性權限', leaves: ['private / friends / public'] },
      { title: '真實性限制', leaves: ['1 小時 / 1 公里'] }
    ]
  },
  {
    title: '地圖定位',
    tone: 'violet',
    items: [
      { title: 'Mapbox 地圖' },
      { title: '使用者定位', leaves: ['GPS 精確定位', 'IP 大略定位'] },
      { title: '日記 Marker', leaves: ['marker clustering'] },
      { title: '地圖控制', leaves: ['目前位置 / 2D / 指北針'] }
    ]
  },
  {
    title: '好友社交',
    tone: 'amber',
    items: [
      { title: '搜尋好友' },
      { title: '好友邀請', leaves: ['收回邀請', '接受 / 拒絕'] },
      { title: '好友列表', leaves: ['資料卡 / 刪除好友'] },
      { title: '智慧推薦好友' }
    ]
  }
];

const systemTreeAdvancedModules = [
  {
    title: '動態互動',
    tone: 'cyan',
    items: [
      { title: '動態頁 Feed' },
      { title: '日記來源', leaves: ['附近公開日記', '好友日記'] },
      { title: '共鳴按鈕' },
      { title: '即時 UI 更新' }
    ]
  },
  {
    title: 'Adrift Intelligence',
    tone: 'blue',
    items: [
      { title: 'Gemini API' },
      { title: '整體摘要' },
      { title: '情緒與地點', leaves: ['情緒趨勢', '地點洞察'] },
      { title: '個人化輸出', leaves: ['行為模式 / 智慧建議'] }
    ]
  },
  {
    title: '管理員系統',
    tone: 'violet',
    items: [
      { title: '權限角色', leaves: ['user', 'admin', 'owner'] },
      { title: 'Admin Dashboard' },
      { title: '資料管理', leaves: ['使用者管理', '日記管理'] },
      { title: 'Owner 權限', leaves: ['角色設定 / 刪除使用者'] }
    ]
  },
  {
    title: '通知與提示',
    tone: 'amber',
    items: [
      { title: '通知 dropdown' },
      { title: '好友邀請通知' },
      { title: '系統提示' },
      { title: '操作回饋', leaves: ['toast', 'inline message'] }
    ]
  }
];

const systemTreeModules = [
  {
    title: '帳號管理',
    tone: 'cyan',
    items: [
      { title: '註冊 / 登入', leaves: ['JWT · bcrypt'] },
      { title: '使用者 ID' },
      { title: '資料設定', leaves: ['修改 · 刪除'] }
    ]
  },
  {
    title: '地圖日記',
    tone: 'blue',
    items: [
      { title: '日記 CRUD' },
      { title: '心情 / 圖片' },
      { title: '權限與限制', leaves: ['private · friends · public · 1h/1km'] }
    ]
  },
  {
    title: '地圖定位',
    tone: 'violet',
    items: [
      { title: 'Mapbox 地圖' },
      { title: 'GPS / IP 定位' },
      { title: 'Marker / clustering' }
    ]
  },
  {
    title: '好友社交',
    tone: 'amber',
    items: [
      { title: '搜尋好友' },
      { title: '邀請狀態' },
      { title: '好友列表 / 推薦' }
    ]
  },
  {
    title: '動態互動',
    tone: 'cyan',
    items: [
      { title: 'Feed 動態頁' },
      { title: '公開 / 好友日記' },
      { title: '共鳴 / 通知' }
    ]
  },
  {
    title: 'Adrift Intelligence',
    tone: 'blue',
    items: [
      { title: 'Gemini API' },
      { title: '情緒與地點洞察' },
      { title: '行為模式 / 智慧建議' }
    ]
  },
  {
    title: '管理員系統',
    tone: 'violet',
    items: [
      { title: 'user / admin / owner' },
      { title: 'Admin Dashboard' },
      { title: '使用者 / 日記管理' }
    ]
  },
  {
    title: '通知提示',
    tone: 'amber',
    items: [
      { title: '通知 dropdown' },
      { title: 'Toast / inline message' },
      { title: '即時狀態回饋' }
    ]
  }
];

const futureItems = ['手機版體驗', '完整通知系統', '日記回憶功能', '好友互動深化', '地點情緒熱力圖', 'Adrift Intelligence 優化'];
const teamRows = [
  ['張惠芯', '圖形繪製、文書資料處理、協助手機版程式製作'],
  ['洪藝文', '圖形繪製、文書資料處理、協助手機版程式製作'],
  ['王浩宇', '圖形繪製、手機版程式製作'],
  ['陳恩儒', '電腦版程式製作；網站版補充：前端、後端 API、MongoDB、Mapbox、好友系統、Admin / Owner、Adrift Intelligence']
];

export default function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const pageRef = useRef(null);
  const currentSlideRef = useRef(currentSlide);
  const activeSlide = slides[currentSlide] ?? slides[0];
  const activeGroup = activeSlide.group;

  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  function isPageScrollContainer() {
    const root = pageRef.current;
    if (!root) return false;

    const overflowY = window.getComputedStyle(root).overflowY;
    return overflowY !== 'visible' && overflowY !== 'clip' && root.scrollHeight > root.clientHeight + 4;
  }

  function getSlideIndexFromScroll() {
    const root = pageRef.current;
    if (!root) return currentSlideRef.current;

    if (!isPageScrollContainer()) {
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      const viewportTop = window.scrollY;

      slides.forEach((slide, index) => {
        const target = document.getElementById(slide.id);
        if (!target) return;

        const distance = Math.abs(target.getBoundingClientRect().top + window.scrollY - viewportTop);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      return closestIndex;
    }

    const maxScrollTop = root.scrollHeight - root.clientHeight;
    if (root.scrollTop >= maxScrollTop - 4) return slides.length - 1;

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide, index) => {
      const target = document.getElementById(slide.id);
      if (!target) return;

      const distance = Math.abs(target.offsetTop - root.scrollTop);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  function getActionSlideIndex() {
    const root = pageRef.current;
    const index = getSlideIndexFromScroll();

    if (isPageScrollContainer()) {
      const maxScrollTop = root.scrollHeight - root.clientHeight;
      if (index === slides.length - 1 && root.scrollTop < maxScrollTop - 4) {
        return slides.length - 2;
      }
    }

    return index;
  }

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return undefined;

    let animationFrame = 0;

    function syncCurrentSlide() {
      animationFrame = 0;
      const nextIndex = getSlideIndexFromScroll();
      if (nextIndex !== currentSlideRef.current) {
        currentSlideRef.current = nextIndex;
        setCurrentSlide(nextIndex);
      }
    }

    function handleScroll() {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(syncCurrentSlide);
    }

    const scrollTarget = isPageScrollContainer() ? root : window;

    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', syncCurrentSlide);
    syncCurrentSlide();

    return () => {
      scrollTarget.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', syncCurrentSlide);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  function goToSlide(index) {
    const safeIndex = Math.max(0, Math.min(index, slides.length - 1));
    const nextId = slides[safeIndex]?.id;
    const target = nextId ? document.getElementById(nextId) : null;

    if (!target) {
      console.warn('Slide not found:', nextId);
      return;
    }

    currentSlideRef.current = safeIndex;
    setCurrentSlide(safeIndex);
    const root = pageRef.current;
    const useRootScroll = isPageScrollContainer();
    const targetTop = safeIndex === slides.length - 1 && root && useRootScroll
      ? root.scrollHeight - root.clientHeight
      : target.offsetTop;

    if (root && useRootScroll) {
      root.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    }
  }

  function goToPreviousSlide() {
    goToSlide(getActionSlideIndex() - 1);
  }

  function goToNextSlide() {
    goToSlide(getActionSlideIndex() + 1);
  }

  function goToGroup(groupLabel) {
    const groupIndex = slides.findIndex((slide) => slide.group === groupLabel);
    if (groupIndex >= 0) goToSlide(groupIndex);
  }

  useEffect(() => {
    function handleKeys(event) {
      const tagName = event.target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;

      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        goToNextSlide();
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPreviousSlide();
      }

      if (event.key === 'Home') {
        event.preventDefault();
        goToSlide(0);
      }

      if (event.key === 'End') {
        event.preventDefault();
        goToSlide(slides.length - 1);
      }
    }

    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, []);

  return (
    <motion.main className="presentation-page" ref={pageRef} {...pageFadeUp}>
      <PresentationAtmosphere />
      <PresentationNav activeGroup={activeGroup} onSelect={goToGroup} />

      <section className="presentation-cover presentation-section" id="cover">
        <div className="presentation-section-inner presentation-cover-inner">
          <div className="presentation-cover-copy">
            <p className="presentation-kicker">資管三B D2 · 專題口試展示</p>
            <h1 className="cover-title-en">Adrift</h1>
            <h2 className="cover-title-zh">漂流足跡</h2>
            <p className="presentation-tagline">A map-based social diary where emotions drift across the world.</p>
            <p className="presentation-lead">結合地圖、日記、情緒、社交與 Adrift Intelligence 的互動式生活記錄平台。</p>
            <p className="presentation-advisors">張怡君老師、張瑋珊老師 共同執導</p>
            <div className="presentation-member-grid">
              {memberList.map(([name, id]) => (
                <span key={id}>{name} <strong>{id}</strong></span>
              ))}
            </div>
          </div>
          <VisualOrb />
        </div>
      </section>

      <SlideSection id="motivation" eyebrow="Motivation" title="為什麼需要 Adrift？" subtitle="日記不該只是一段文字，它也應該記得當時的地點、心情與生活情境。">
        <div className="presentation-split">
          <article className="presentation-statement-card">
            <strong>讓記憶回到現場</strong>
            <p>Adrift 希望把日記從文字清單，轉成能在地圖上被重新看見的生活足跡。</p>
          </article>
          <div className="presentation-card-grid three">
            {problemCards.map(([title, text, icon], index) => (
              <FeatureCard key={title} title={title} text={text} icon={icon} index={index} />
            ))}
          </div>
        </div>
      </SlideSection>

      <SlideSection id="problem" eyebrow="Problem Analysis" title="現有日記工具的不足" subtitle="文字能記錄事件，但常常缺少能喚回記憶的脈絡。">
        <div className="presentation-card-grid three spacious">
          {problemCards.map(([title, text, icon], index) => (
            <FeatureCard key={title} title={title} text={text} icon={icon} index={index} large />
          ))}
        </div>
      </SlideSection>

      <SlideSection id="goal" eyebrow="Project Goal" title="讓每段記憶回到它發生的地方" subtitle="Adrift 的核心目標，是把地點、心情與分享範圍一起放回日記。">
        <div className="presentation-goal-grid">
          {goalCards.map(([title, text, icon], index) => (
            <GoalCard key={title} title={title} text={text} icon={icon} index={index} />
          ))}
        </div>
      </SlideSection>

      <SlideSection id="overview" eyebrow="System Overview" title="系統總覽" subtitle="帳號、地圖日記、好友關係與 Adrift Intelligence，組成完整的定位式日記平台。">
        <div className="presentation-card-grid four spacious">
          {overviewCards.map(([title, text, icon], index) => (
            <FeatureCard key={title} title={title} text={text} icon={icon} index={index} />
          ))}
        </div>
      </SlideSection>

      <SlideSection id="map-diary" eyebrow="Core Feature 01" title="地圖日記" subtitle="以地圖作為主介面，讓使用者在真實地點留下日記、照片與心情。">
        <div className="presentation-feature-layout">
          <VisualOrb compact />
          <div className="presentation-card-grid two">
            {mapDiaryCards.map(([title, text, icon], index) => (
              <FeatureCard key={title} title={title} text={text} icon={icon} index={index} />
            ))}
          </div>
        </div>
      </SlideSection>

      <SlideSection id="friends" eyebrow="Core Feature 02" title="好友社交" subtitle="好友功能不是曝光導向，而是讓使用者選擇能一起分享記憶的人。">
        <div className="presentation-card-grid four spacious">
          {socialCards.map(([title, text, icon], index) => (
            <FeatureCard key={title} title={title} text={text} icon={icon} index={index} />
          ))}
        </div>
      </SlideSection>

      <SlideSection id="authenticity" eyebrow="Core Feature 03" title="真實性限制" subtitle="Adrift 不是任意修改的日記系統，而是保留當下、當地、當時心情。">
        <div className="presentation-card-grid four spacious">
          {authenticityCards.map(([title, text, icon], index) => (
            <FeatureCard key={title} title={title} text={text} icon={icon} index={index} />
          ))}
        </div>
        <div className="presentation-warning-card calm">
          <strong>超過 1 小時或離開原地點 1 公里以上，就不能再編輯。</strong>
          <span>時間與位置是日記真實性的核心，因此後端會再次檢查，不能只靠前端判斷。</span>
        </div>
      </SlideSection>

      <SlideSection id="life-map-ai" eyebrow="Core Feature 04" title="Adrift Intelligence" subtitle="Adrift Intelligence 只協助整理自己的日記與生活軌跡，不做醫療或心理診斷。">
        <div className="ai-dashboard-preview airy">
          <div className="ai-summary-card">
            <Brain size={28} />
            <h3>Adrift Intelligence 智慧洞察儀表板</h3>
            <p>根據使用者自己的日記、心情、時間與地點，產生個人化生活洞察。</p>
          </div>
          {aiFeatureCards.map(([title, text, icon], index) => (
            <FeatureCard key={title} title={title} text={text} icon={icon} index={index} compact />
          ))}
        </div>
        <p className="presentation-footnote">Adrift Intelligence 僅供自我回顧參考，並非醫療或心理診斷。</p>
      </SlideSection>

      <SlideSection id="user-flow" eyebrow="User Flow" title="使用者流程" subtitle="從帳號、地圖日記、好友互動到 Adrift Intelligence，整理 Adrift 使用者的完整操作路徑。">
        <HorizontalUserFlow steps={userFlowBranches} />
      </SlideSection>

      <SlideSection id="architecture" eyebrow="Architecture" title="系統架構" subtitle="以七個主要模組呈現 Adrift 的使用者功能、互動能力、Adrift Intelligence 與管理機制。">
        <PresentationSystemTree rootTitle="Adrift 漂流足跡" modules={systemTreeModules} compact compactColumns={4} />
      </SlideSection>

      <SlideSection id="frontend-tech" eyebrow="Frontend Technology" title="技術架構 - 前端" subtitle="前端負責地圖互動、狀態即時更新、動畫與正式產品級 UI。">
        <TechMap items={frontendTech} icon={<Code2 size={24} />} />
      </SlideSection>

      <SlideSection id="backend-tech" eyebrow="Backend Technology" title="技術架構 - 後端" subtitle="後端負責驗證、日記真實性規則、好友權限、地理查詢與 Adrift Intelligence 串接。">
        <TechMap items={backendTech} icon={<Server size={24} />} />
      </SlideSection>

      <SlideSection id="ux" eyebrow="Design System" title="UI / UX 設計理念" subtitle="用深色地圖、玻璃質感與低調動畫，把日記呈現成漂浮的記憶光點。">
        <div className="ux-showcase">
          <div>
            <h3>以地圖作為主介面</h3>
            <p>Adrift 採用深色地圖介面與 玻璃擬態視覺，讓日記像漂浮在地圖上的記憶光點。</p>
          </div>
          <ul>
            <li>左側日記詳情，右側日記列表，地圖維持主要視覺焦點。</li>
            <li>好友頁作為社交中心，整理搜尋、邀請、好友與推薦。</li>
            <li>Adrift Intelligence 作為洞察儀表板，而不是普通聊天框。</li>
            <li>動畫以過渡為主，提示訊息不遮擋重要資訊。</li>
          </ul>
        </div>
      </SlideSection>

      <SlideSection id="difference" eyebrow="Positioning" title="Adrift 與一般日記 App 的差異" subtitle="不是單純文字紀錄，也不是公開曝光社群，而是以真實地點承載情緒與故事。">
        <div className="comparison-grid">
          <CompareCard title="傳統日記 App" text="以文字紀錄為主，地點通常只是附加資訊。" />
          <CompareCard title="Instagram 類社群" text="偏向公開曝光與照片分享，社交壓力較高。" />
          <CompareCard title="Google Maps Timeline" text="記錄移動軌跡，但不記錄當下心情與故事。" />
          <CompareCard title="Adrift" highlight text="以地圖為核心，結合日記、情緒、好友、權限與 Adrift Intelligence，讓記憶回到真實地點。" />
        </div>
      </SlideSection>

      <SlideSection id="admin-role" eyebrow="Governance" title="管理員與權限設計" subtitle="除了使用者功能，Adrift 也設計了平台治理與角色權限。">
        <div className="presentation-card-grid three spacious">
          <FeatureCard title="User" text="寫日記、加好友、使用 Adrift Intelligence。" icon={<Users size={22} />} index={0} large />
          <FeatureCard title="Admin" text="管理使用者與日記，刪除違規內容。" icon={<ShieldCheck size={22} />} index={1} large />
          <FeatureCard title="Owner" text="最高權限，可設定角色並維護平台安全。" icon={<Lock size={22} />} index={2} large />
        </div>
      </SlideSection>

      <SlideSection id="future" eyebrow="Roadmap" title="未來展望" subtitle="持續強化真實性、好友互動、手機體驗與 Adrift Intelligence，讓 Adrift 更接近正式產品。">
        <div className="future-grid">
          {futureItems.map((item, index) => (
            <motion.span key={item} {...listItemMotion(index)}>
              <CheckCircle2 size={16} />
              {item}
            </motion.span>
          ))}
        </div>
        <p className="future-copy">未來 Adrift 將持續強化定位式日記的真實性、好友互動與 Adrift Intelligence 洞察能力，讓使用者能更自然地回顧生活中的地點、情緒與記憶。</p>
      </SlideSection>

      <SlideSection id="team" eyebrow="Team" title="分工表" subtitle="以 PDF 分工為主，補充目前網站版開發內容，呈現專題合作成果。">
        <div className="team-table">
          {teamRows.map(([name, work], index) => (
            <motion.div key={name} className="team-row" {...listItemMotion(index)}>
              <strong>{name}</strong>
              <span>{work}</span>
            </motion.div>
          ))}
        </div>
      </SlideSection>

      <SlideSection id="demo" eyebrow="Demo" title="Demo Website" subtitle="直接進入線上版本，展示地圖日記、好友社交、Adrift Intelligence 與管理功能。">
        <div className="demo-panel">
          <div>
            <h3>https://adrifttw.com</h3>
            <p>實際展示地圖日記、好友社交、附近動態、Adrift Intelligence 與 Admin / Owner 管理功能。</p>
          </div>
          <a className="presentation-cta" href="https://adrifttw.com" target="_blank" rel="noreferrer">
            前往 Adrift
          </a>
        </div>
      </SlideSection>

      <section className="presentation-thanks presentation-section" id="thank-you">
        <div className="presentation-section-inner presentation-thanks-inner">
          <p>Thank you for listening</p>
          <h2>Adrift 漂流足跡</h2>
          <span>讓每一段記憶，回到它發生的地方。</span>
          <small>資管三B D2 · adrifttw.com</small>
        </div>
      </section>

      <PresentationControls
        activeIndex={currentSlide}
        onGoToPrevious={goToPreviousSlide}
        onGoToNext={goToNextSlide}
      />
    </motion.main>
  );
}

function PresentationNav({ activeGroup, onSelect }) {
  return (
    <aside className="presentation-nav" aria-label="簡報章節">
      {navGroups.map((group) => (
        <button
          key={group.label}
          className={activeGroup === group.label ? 'active' : ''}
          type="button"
          onClick={() => onSelect(group.label)}
        >
          {group.label}
        </button>
      ))}
    </aside>
  );
}

function PresentationControls({ activeIndex, onGoToPrevious, onGoToNext }) {
  const isFirst = activeIndex <= 0;
  const isLast = activeIndex >= slides.length - 1;
  const progress = ((activeIndex + 1) / slides.length) * 100;

  return (
    <div className="presentation-controls" aria-label="簡報控制">
      <div className="presentation-progress">
        <span>{String(activeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
        <div className="presentation-progress-track">
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="presentation-control-actions">
        <button
          className="presentation-control-button"
          type="button"
          onClick={onGoToPrevious}
          disabled={isFirst}
        >
          <ArrowLeft size={16} />
          上一頁
        </button>
        <button
          className="presentation-control-button primary"
          type="button"
          onClick={onGoToNext}
          disabled={isLast}
        >
          下一頁
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function GoalCard({ icon, title, text, index = 0 }) {
  return (
    <motion.article className="presentation-goal-card" {...listItemMotion(index)}>
      <div className="goal-card-orbit">
        <span>{icon}</span>
      </div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </motion.article>
  );
}

function SlideSection({ id, eyebrow, title, subtitle, children }) {
  return (
    <motion.section className="presentation-section" id={id} {...pageFadeUp}>
      <div className="presentation-section-inner">
        <div className="presentation-section-heading">
          <p>{eyebrow}</p>
          <h2>{title}</h2>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {children}
      </div>
    </motion.section>
  );
}

function FeatureCard({ icon, title, text, index = 0, large = false, compact = false }) {
  return (
    <motion.article
      className={`presentation-feature-card ${large ? 'large' : ''} ${compact ? 'compact-card' : ''}`}
      {...listItemMotion(index)}
    >
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </motion.article>
  );
}

function ChartConnectors({ count, type = 'flowchart' }) {
  const center = 500;
  const railY = type === 'system' ? 120 : 122;
  const branchY = type === 'system' ? 150 : 152;
  const firstX = 1000 / count / 2;
  const lastX = 1000 - firstX;
  const branchLines = Array.from({ length: count }, (_, index) => {
    const x = firstX + index * ((lastX - firstX) / Math.max(1, count - 1));
    return `M${x.toFixed(2)} ${railY} V${branchY}`;
  }).join(' ');
  const mainPath = `M${center} 28 V${railY} M${firstX.toFixed(2)} ${railY} H${lastX.toFixed(2)} ${branchLines}`;

  return (
    <svg className={`${type}-connectors`} viewBox="0 0 1000 190" preserveAspectRatio="none" aria-hidden="true">
      <path className="connector-main" d={mainPath} />
    </svg>
  );
}

function HorizontalUserFlow({ steps }) {
  return (
    <div className="horizontal-user-flow" aria-label="Adrift 使用者流程圖">
      <div className="horizontal-flow-track" aria-hidden="true">
        <span />
      </div>
      {steps.map((step, index) => (
        <motion.article className="horizontal-flow-step" key={step.title} {...listItemMotion(index)}>
          <span className="horizontal-flow-index">{String(index + 1).padStart(2, '0')}</span>
          <div className="horizontal-flow-copy">
            <h3>{step.title}</h3>
            <p>{step.subtitle}</p>
          </div>
          <ul>
            {step.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </motion.article>
      ))}
    </div>
  );
}

function PresentationFlowChart({ rootTitle, branches, compact = false, compactColumns = 3 }) {
  return (
    <div
      className={`presentation-flowchart ${compact ? 'compact-chart' : ''}`}
      style={{ '--chart-columns': branches.length, '--compact-columns': compactColumns }}
      aria-label={`${rootTitle}流程圖`}
    >
      {!compact && <ChartConnectors count={branches.length} />}
      <motion.div className="flowchart-root flow-node root-node" {...listItemMotion(0)}>
        {rootTitle}
      </motion.div>
      <div className="flowchart-branches">
        {branches.map((branch, branchIndex) => (
          <motion.section className="flowchart-branch" key={branch.title} {...listItemMotion(branchIndex + 1)}>
            <div className="flow-node branch-node">{branch.title}</div>
            <div className="flowchart-actions">
              {branch.items.map((item) => (
                <div className="flow-action-group" key={item.title}>
                  <div className="flow-node action-node">{item.title}</div>
                  {item.leaves?.length > 0 && (
                    <div className="flowchart-leaves">
                      {item.leaves.map((leaf) => (
                        <span className="flow-leaf" key={`${item.title}-${leaf}`}>
                          {leaf}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
}

function PresentationSystemTree({ rootTitle, modules, compact = false, compactColumns = 3 }) {
  return (
    <div
      className={`presentation-system-tree ${compact ? 'compact-chart' : ''}`}
      style={{ '--chart-columns': modules.length, '--compact-columns': compactColumns }}
      aria-label={`${rootTitle}系統架構樹狀圖`}
    >
      {!compact && <ChartConnectors count={modules.length} type="system" />}
      <motion.div className="system-tree-root flow-node root-node" {...listItemMotion(0)}>
        {rootTitle}
      </motion.div>
      <div className="system-tree-modules">
        {modules.map((module, moduleIndex) => (
          <motion.section className={`system-module ${module.tone}`} key={module.title} {...listItemMotion(moduleIndex + 1)}>
            <div className="flow-node module-node">{module.title}</div>
            <div className="system-module-items">
              {module.items.map((item) => (
                <div className="system-feature-chip" key={item.title}>
                  <strong>{item.title}</strong>
                  {item.leaves?.length > 0 && <span>{item.leaves.join(' · ')}</span>}
                </div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
}

function CompareCard({ title, text, highlight = false }) {
  return (
    <article className={`compare-card ${highlight ? 'highlight' : ''}`}>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function TechMap({ items, icon }) {
  return (
    <div className="tech-map">
      <div className="tech-map-core">
        {icon}
        <strong>Adrift Stack</strong>
      </div>
      <div className="tech-map-items">
        {items.map(([title, text], index) => (
          <motion.article className="tech-map-node" key={title} {...listItemMotion(index)}>
            <strong>{title}</strong>
            <p>{text}</p>
          </motion.article>
        ))}
      </div>
    </div>
  );
}

const VisualOrb = memo(function VisualOrb({ compact = false }) {
  const dots = useMemo(
    () => [
      ['dot-a', 'home'],
      ['dot-b', 'mood'],
      ['dot-c', 'friend'],
      ['dot-d', 'Intelligence']
    ],
    []
  );

  return (
    <div className={`presentation-visual ${compact ? 'compact' : ''}`} aria-hidden="true">
      <span className="presentation-map-ring ring-a" />
      <span className="presentation-map-ring ring-b" />
      <span className="presentation-orb">
        <img src="/adrift-icon.png" alt="" aria-hidden="true" />
      </span>
      <span className="presentation-path path-a" />
      <span className="presentation-path path-b" />
      <span className="presentation-path path-c" />
      {dots.map(([className, label]) => (
        <span className={`presentation-dot ${className}`} key={className}><i>{label}</i></span>
      ))}
    </div>
  );
});

const PresentationAtmosphere = memo(function PresentationAtmosphere() {
  return (
    <div className="presentation-atmosphere" aria-hidden="true">
      <span className="atmosphere-line line-a" />
      <span className="atmosphere-line line-b" />
      <span className="atmosphere-glow glow-a" />
      <span className="atmosphere-glow glow-b" />
    </div>
  );
});
