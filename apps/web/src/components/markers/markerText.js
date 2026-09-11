import { MOOD_OPTIONS } from '../../constants/app.js';

const labels = { ...Object.fromEntries(MOOD_OPTIONS), happy: '開心', angry: '生氣', excited: '興奮', anxiety: '焦慮' };
const formatter = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function markerTitle(diary) {
  return diary?.title || diary?.text?.slice?.(0, 18) || diary?.content?.slice?.(0, 18) || '未命名日記';
}

export function markerMood(type) {
  return labels[type] || '其他';
}

export function markerTime(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? formatter.format(date) : '時間未提供';
}
