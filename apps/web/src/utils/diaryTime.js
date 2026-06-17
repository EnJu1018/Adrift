export function formatDiaryTime(createdAt, nowValue = Date.now()) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date(nowValue);
  const diff = now.getTime() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const year = 365 * day;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  if (diff >= 0 && diff < hour) {
    const minuteCount = Math.max(1, Math.floor(diff / minute));
    return `${minuteCount} 分鐘前`;
  }

  if (diff >= 0 && diff < day) {
    return `${Math.floor(diff / hour)} 小時前`;
  }

  if (diff >= 0 && diff < year) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`;
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
