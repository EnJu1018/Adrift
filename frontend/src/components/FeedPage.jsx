import { motion } from 'framer-motion';
import { Heart, MessageCircle, Radio, Users, Waves } from 'lucide-react';
import { useMemo, useState } from 'react';
import { fadeUpMotion } from '../constants/animations.js';
import { MOOD_LABELS } from '../constants/app.js';
import { formatDiaryTime } from '../utils/diaryTime.js';

const feedFilters = [
  { value: 'all', label: '全部' },
  { value: 'friends', label: '好友' },
  { value: 'public', label: '公開' }
];

export default function FeedPage({ diaries = [], user, onOpenDiary }) {
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
    <motion.section className="feed-page glass" {...fadeUpMotion}>
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
            className={filter === option.value ? 'active' : ''}
            type="button"
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="feed-list">
        {feedItems.length > 0 ? (
          feedItems.map((diary, index) => (
            <motion.article
              key={diary._id}
              className="feed-card"
              onClick={() => onOpenDiary?.(diary)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onOpenDiary?.(diary);
              }}
              {...fadeUpMotion}
              transition={{ ...fadeUpMotion.transition, delay: Math.min(index * 0.03, 0.18) }}
            >
              <div className="feed-card-header">
                <span className="avatar-orb small">{getAuthorName(diary, user).slice(0, 1).toUpperCase()}</span>
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
              <p>{summarizeDiary(diary.text || diary.content)}</p>

              <footer>
                <span>
                  <Radio size={14} />
                  {MOOD_LABELS[diary.mood?.type] || diary.mood?.type || '心情'} / {diary.mood?.intensity || '-'}
                </span>
                <span>
                  <Heart size={14} />
                  {(diary.reactions?.understand || 0) + (diary.reactions?.hug || 0) + (diary.reactions?.relate || 0)}
                </span>
                <span>
                  <MessageCircle size={14} />
                  查看詳情
                </span>
              </footer>
            </motion.article>
          ))
        ) : (
          <div className="feed-empty">
            <Radio size={20} />
            <h3>目前還沒有動態</h3>
            <p>新增日記或加入好友後，就能看到新的動態。</p>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function getAuthorName(diary, currentUser) {
  return diary.author?.name || diary.user?.name || currentUser?.name || 'A';
}

function getAuthorCode(diary, currentUser) {
  return diary.author?.userCode || diary.user?.userCode || currentUser?.userCode || 'unknown';
}

function summarizeDiary(value = '') {
  const text = value.trim();
  if (text.length <= 140) return text || '沒有內容';
  return `${text.slice(0, 140)}...`;
}
