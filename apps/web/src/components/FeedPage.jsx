import { AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Plus, Radio, Users, Waves } from 'lucide-react';
import { useMemo, useState } from 'react';
import ContentTransition from './ui/ContentTransition.jsx';
import { MOOD_LABELS } from '../constants/app.js';
import { formatDiaryTime } from '../utils/diaryTime.js';
import DiaryImage from './DiaryImage.jsx';
import UserAvatar from './UserAvatar.jsx';
import AnimatedNumber from './ui/AnimatedNumber.jsx';

const feedFilters = [
  { value: 'all', label: '全部' },
  { value: 'friends', label: '好友' },
  { value: 'public', label: '公開' }
];

export default function FeedPage({ diaries = [], user, onOpenDiary, onNewDiary }) {
  const [filter, setFilter] = useState('all');
  const timeNow = Date.now();

  const feedItems = useMemo(() => {
    return diaries
      .filter((diary) => {
        if (diary.visibility === 'private') return false;
        if (filter === 'friends') return diary.visibility === 'friends';
        if (filter === 'public') return diary.visibility === 'public';
        return diary.visibility === 'friends' || diary.visibility === 'public';
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [diaries, filter]);

  return (
    <section className="feed-page glass">
      <header className="feed-page-hero">
        <div>
          <p className="eyebrow">Feed</p>
          <h2>動態</h2>
          <span>看看朋友與附近的人最近留下了什麼記憶</span>
        </div>
      </header>

      <div className="feed-filter" aria-label="動態篩選">
        {feedFilters.map((option) => (
          <button
            key={option.value}
            className={`motion-soft-press ${filter === option.value ? 'active' : ''}`}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="feed-list">
        <AnimatePresence initial={false}>
        {feedItems.length > 0 ? (
          feedItems.map((diary) => (
            <ContentTransition collapse key={diary._id}>
            <article
              className="feed-card motion-card-hover"
              onClick={() => onOpenDiary?.(diary)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenDiary?.(diary);
                }
              }}
            >
              <div className="feed-card-header">
                <UserAvatar user={getAuthor(diary, user)} size="sm" />
                <div>
                  <strong>@{getAuthorCode(diary, user)}</strong>
                  <span>{formatDiaryTime(diary.createdAt, timeNow)}</span>
                </div>
                <span className={`feed-visibility ${diary.visibility}`}>
                  {diary.visibility === 'friends' ? <Users size={14} /> : <Waves size={14} />}
                  {diary.visibility === 'friends' ? '好友' : '公開'}
                </span>
              </div>

              <h3>{diary.title || '（未命名日記）'}</h3>
              {diary.imageUrl && (
                <DiaryImage
                  className="feed-card-image"
                  src={diary.imageUrl}
                  alt={`日記「${diary.title || '未命名日記'}」的照片`}
                />
              )}
              <p>{summarizeDiary(diary.text || diary.content)}</p>

              <footer>
                <span>
                  <Radio size={14} />
                  {MOOD_LABELS[diary.mood?.type] || diary.mood?.type || '心情'} / {diary.mood?.intensity || '-'}
                </span>
                <span>
                  <Heart size={14} />
                  <AnimatedNumber value={(diary.reactions?.understand || 0) + (diary.reactions?.hug || 0) + (diary.reactions?.relate || 0)} variant="reaction" />
                </span>
                <span>
                  <MessageCircle size={14} />
                  查看詳情
                </span>
              </footer>
            </article>
            </ContentTransition>
          ))
        ) : (
          <ContentTransition collapse key="empty"><div className="feed-empty">
            <Radio size={20} />
            <h3>附近還很安靜</h3>
            <p>先把這裡變成你的記憶地圖。即使只有自己可見，也能在未來回顧今天的生活片段。</p>
            <button className="chip-button motion-soft-press" type="button" onClick={onNewDiary}>
              <Plus size={15} />
              留下第一篇日記
            </button>
          </div></ContentTransition>
        )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function getAuthorCode(diary, currentUser) {
  return diary.author?.userCode || diary.user?.userCode || currentUser?.userCode || 'unknown';
}

function getAuthor(diary, currentUser) {
  return diary.author || diary.user || currentUser || null;
}

function summarizeDiary(value = '') {
  const text = value.trim();
  if (text.length <= 140) return text || '沒有內容';
  return `${text.slice(0, 140)}...`;
}
