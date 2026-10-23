export const PUBLIC_SEO = {
  '/': {
    title: 'Adrift 漂流足跡｜地圖日記與城市記憶平台',
    description: 'Adrift 漂流足跡是一個結合地圖、日記、心情與好友社交的城市記憶平台。你可以在真實地點留下生活片段，回顧自己的情緒足跡，也探索別人的公開記憶。',
    url: 'https://adrifttw.com/',
    schemaType: 'WebApplication'
  },
  '/about': {
    title: '什麼是 Adrift 漂流足跡？｜地圖日記與城市記憶平台',
    description: '了解 Adrift 漂流足跡如何把地點、日記、情緒與好友關係結合，讓使用者在真實地點留下生活片段，建立自己的城市記憶系統。',
    url: 'https://adrifttw.com/about',
    schemaType: 'AboutPage'
  },
  '/features/map-diary': {
    title: '地圖日記｜Adrift 漂流足跡',
    description: '地圖日記讓你把生活片段留在真實發生的地方。每一篇日記都包含地點、時間、心情與故事，讓回憶回到城市地圖上。',
    url: 'https://adrifttw.com/features/map-diary',
    schemaType: 'WebPage'
  },
  '/features/emotion': {
    title: '情緒足跡｜Adrift 漂流足跡',
    description: '情緒足跡讓你記錄每個地點當下的心情與強度，當紀錄累積後，看見自己在不同時間與地點的生活節奏。',
    url: 'https://adrifttw.com/features/emotion',
    schemaType: 'WebPage'
  },
  '/features/memories': {
    title: '城市記憶｜Adrift 漂流足跡',
    description: '城市記憶是 Adrift 的核心概念。隨著日記累積，地圖會慢慢變成屬於你和朋友的生活記憶系統。',
    url: 'https://adrifttw.com/features/memories',
    schemaType: 'WebPage'
  },
  '/privacy': {
    title: 'Adrift 隱私設計｜日記可見性、地點資料與智慧洞察',
    description: '了解 Adrift 漂流足跡如何處理日記可見性、地點資料與 Adrift Intelligence，讓使用者控制私人、好友與公開記憶。',
    url: 'https://adrifttw.com/privacy',
    schemaType: 'WebPage'
  }
};

function upsertMeta({ selector, attribute, value, content }) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    const [name, attrValue] = attribute;
    element.setAttribute(name, attrValue);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content || value);
}

export function updatePublicSeo(pathname) {
  const normalizedPath = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  const seo = PUBLIC_SEO[normalizedPath];
  if (!seo) return;

  const image = 'https://adrifttw.com/icon-512.png';

  document.title = seo.title;
  upsertMeta({ selector: 'meta[name="description"]', attribute: ['name', 'description'], content: seo.description });
  upsertMeta({ selector: 'meta[property="og:title"]', attribute: ['property', 'og:title'], content: seo.title });
  upsertMeta({ selector: 'meta[property="og:description"]', attribute: ['property', 'og:description'], content: seo.description });
  upsertMeta({ selector: 'meta[property="og:url"]', attribute: ['property', 'og:url'], content: seo.url });
  upsertMeta({ selector: 'meta[property="og:type"]', attribute: ['property', 'og:type'], content: 'website' });
  upsertMeta({ selector: 'meta[property="og:image"]', attribute: ['property', 'og:image'], content: image });
  upsertMeta({ selector: 'meta[name="twitter:card"]', attribute: ['name', 'twitter:card'], content: 'summary_large_image' });
  upsertMeta({ selector: 'meta[name="twitter:title"]', attribute: ['name', 'twitter:title'], content: seo.title });
  upsertMeta({ selector: 'meta[name="twitter:description"]', attribute: ['name', 'twitter:description'], content: seo.description });
  upsertMeta({ selector: 'meta[name="twitter:image"]', attribute: ['name', 'twitter:image'], content: image });

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', seo.url);

  const schema = {
    '@context': 'https://schema.org',
    '@type': seo.schemaType,
    name: normalizedPath === '/' ? 'Adrift 漂流足跡' : seo.title,
    alternateName: ['Adrift', '漂流足跡'],
    url: seo.url,
    description: seo.description,
    inLanguage: 'zh-TW'
  };

  if (seo.schemaType === 'WebApplication') {
    schema.applicationCategory = 'LifestyleApplication';
    schema.operatingSystem = 'Web';
    schema.description = 'Adrift 漂流足跡是一個以地圖為核心的生活記錄與城市記憶平台。使用者可以在去過的地點留下日記、照片與情緒，並與好友建立共同的城市記憶。';
    schema.keywords = '地圖日記, 城市記憶, 情緒足跡, 好友記憶, Adrift Intelligence, Google Maps, Instagram, 日記 App';
    schema.offers = {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'TWD'
    };
  }

  let schemaElement = document.getElementById('adrift-route-schema');
  if (!schemaElement) {
    schemaElement = document.createElement('script');
    schemaElement.type = 'application/ld+json';
    schemaElement.id = 'adrift-route-schema';
    document.head.appendChild(schemaElement);
  }
  schemaElement.textContent = JSON.stringify(schema);
}
