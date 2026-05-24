const TAIWAN_PLACE_MAP = {
  'Taipei City': '臺北市',
  Taipei: '臺北市',
  'New Taipei City': '新北市',
  'New Taipei': '新北市',
  'Taipei County': '新北市',
  'Taoyuan City': '桃園市',
  Taoyuan: '桃園市',
  'Taichung City': '臺中市',
  Taichung: '臺中市',
  'Tainan City': '臺南市',
  Tainan: '臺南市',
  'Kaohsiung City': '高雄市',
  Kaohsiung: '高雄市',
  'Keelung City': '基隆市',
  Keelung: '基隆市',
  'Hsinchu City': '新竹市',
  'Hsinchu County': '新竹縣',
  Hsinchu: '新竹市',
  'Miaoli County': '苗栗縣',
  Miaoli: '苗栗縣',
  'Changhua County': '彰化縣',
  Changhua: '彰化縣',
  'Nantou County': '南投縣',
  Nantou: '南投縣',
  'Yunlin County': '雲林縣',
  Yunlin: '雲林縣',
  'Chiayi City': '嘉義市',
  'Chiayi County': '嘉義縣',
  Chiayi: '嘉義市',
  'Pingtung County': '屏東縣',
  Pingtung: '屏東縣',
  'Yilan County': '宜蘭縣',
  Yilan: '宜蘭縣',
  'Hualien County': '花蓮縣',
  Hualien: '花蓮縣',
  'Taitung County': '臺東縣',
  Taitung: '臺東縣',
  'Penghu County': '澎湖縣',
  Penghu: '澎湖縣',
  'Kinmen County': '金門縣',
  Kinmen: '金門縣',
  'Lienchiang County': '連江縣',
  Lienchiang: '連江縣',
  Matsu: '連江縣',
  Taiwan: '臺灣',
  TW: '臺灣',
  'Taiwan Province': '臺灣',
  'Republic of China': '臺灣',
  ROC: '臺灣'
};

const PLACE_REPLACEMENTS = Object.entries(TAIWAN_PLACE_MAP)
  .sort(([left], [right]) => right.length - left.length)
  .map(([source, target]) => [new RegExp(`\\b${escapeRegExp(source)}\\b`, 'gi'), target]);

export function normalizeTaiwanPlaceName(name = '') {
  if (typeof name !== 'string') return '';

  let normalized = name.trim();
  if (!normalized) return '';

  for (const [pattern, target] of PLACE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, target);
  }

  return normalized
    .replaceAll('台北', '臺北')
    .replaceAll('台中', '臺中')
    .replaceAll('台南', '臺南')
    .replaceAll('台東', '臺東')
    .replaceAll('台灣', '臺灣')
    .replace(/Taiwan/gi, '臺灣')
    .replace(/([\u4e00-\u9fff])\s*,\s*([\u4e00-\u9fff])/g, '$1，$2')
    .replace(/\s+，\s+/g, '，')
    .replace(/，{2,}/g, '，')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
