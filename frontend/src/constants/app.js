export const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
export const USER_CODE_PATTERN = /^[a-zA-Z0-9_-]{4,20}$/;

export const ROLE_OPTIONS = ['user', 'admin', 'owner'];
export const ROLE_FILTER_OPTIONS = ['all', ...ROLE_OPTIONS];

export const VISIBILITY_OPTIONS = ['private', 'friends', 'public'];
export const VISIBILITY_FILTER_OPTIONS = ['all', 'public', 'friends', 'private'];

export const MOOD_OPTIONS = [
  ['calm', '平靜'],
  ['joy', '喜悅'],
  ['sad', '低落'],
  ['wonder', '驚奇'],
  ['anxious', '焦慮'],
  ['nostalgic', '懷舊'],
  ['other', '其他']
];

export const MOOD_FILTER_OPTIONS = ['all', ...MOOD_OPTIONS.map(([value]) => value)];

export const MOOD_LABELS = {
  calm: '○ 平靜',
  joy: '✦ 喜悅',
  sad: '● 低落',
  wonder: '◇ 驚奇',
  anxious: '△ 焦慮',
  nostalgic: '● 懷舊',
  other: '• 其他'
};

export const REACTION_OPTIONS = [
  { type: 'understand', icon: '❤️', label: '我懂' },
  { type: 'hug', icon: '🤗', label: '抱抱' },
  { type: 'relate', icon: '🌧', label: '有同感' }
];

export const FALLBACK_DIARY_TITLE = '（未命名日記）';
