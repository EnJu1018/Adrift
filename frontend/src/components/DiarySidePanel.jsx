import { AnimatePresence, motion } from 'framer-motion';
import { Clock3, ImageIcon, Lock, MapPin, Trash2, Users, Waves, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getImageUrl } from '../api/client.js';
import { formatCoordinates, resolvePlaceName } from '../utils/placeName.js';

const visibilityIcons = {
  private: Lock,
  friends: Users,
  public: Waves
};

const visibilityLabels = {
  private: 'private',
  friends: 'friends',
  public: 'public'
};

const moodLabels = {
  calm: '○ 平靜',
  joy: '✦ 喜悅',
  sad: '◌ 低落',
  wonder: '◇ 驚奇',
  anxious: '△ 焦慮',
  nostalgic: '◐ 懷舊',
  other: '• 其他'
};

const fallbackTitle = '（未命名日記）';

export default function DiarySidePanel({ diary, currentUser, onClose, onDelete }) {
  const [resolvedPlaceName, setResolvedPlaceName] = useState('');
  const hasDiary = Boolean(diary);
  const VisibilityIcon = hasDiary ? visibilityIcons[diary.visibility] || Waves : Waves;
  const coordinates = diary?.location?.coordinates || [];
  const lng = Number.isFinite(coordinates[0]) ? coordinates[0] : diary?.location?.lng;
  const lat = Number.isFinite(coordinates[1]) ? coordinates[1] : diary?.location?.lat;
  const currentUserId = currentUser?.id;
  const diaryUserId = diary?.user?._id || diary?.user?.id || diary?.author?._id;
  const isOwner = Boolean(currentUserId && diaryUserId && currentUserId === diaryUserId.toString());
  const author = diary?.user || diary?.author || {};
  const locationText = resolvedPlaceName || diary?.location?.placeName || formatCoordinates(lat, lng);
  const timeText = hasDiary ? formatDiaryDateTime(diary.createdAt) : '';
  const titleText = diary?.title?.trim() || fallbackTitle;

  useEffect(() => {
    let cancelled = false;

    if (!hasDiary) {
      setResolvedPlaceName('');
      return undefined;
    }

    if (diary?.location?.placeName) {
      setResolvedPlaceName(diary.location.placeName);
      return undefined;
    }

    setResolvedPlaceName(formatCoordinates(lat, lng));
    resolvePlaceName(lat, lng).then((name) => {
      if (!cancelled) setResolvedPlaceName(name);
    });

    return () => {
      cancelled = true;
    };
  }, [diary?._id, diary?.location?.placeName, hasDiary, lat, lng]);

  return (
    <motion.aside
      className="diary-side-panel glass"
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
    >
      <AnimatePresence mode="wait">
        {!hasDiary ? (
          <motion.div
            key="empty"
            className="diary-side-empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <span className="brand-mark">
              <MapPin size={20} />
            </span>
            <div>
              <p className="eyebrow">Diary Detail</p>
              <h2>選擇一則日記查看內容</h2>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={diary._id}
            className="diary-side-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
          >
            <header className="diary-side-header">
              <div className="popup-author">
                <span className="avatar-orb small">{(author.name || 'A').slice(0, 1).toUpperCase()}</span>
                <div>
                  <p className="eyebrow">Selected diary</p>
                  <h2>{author.name || 'Unknown'}</h2>
                  <small>@{author.userCode || 'unknown'}</small>
                </div>
              </div>
              <button className="icon-button" onClick={onClose} aria-label="Close diary">
                <X size={17} />
              </button>
            </header>

            {diary.imageUrl ? (
              <img className="diary-side-image" src={getImageUrl(diary.imageUrl)} alt="" />
            ) : (
              <div className="diary-side-image empty">
                <ImageIcon size={18} />
              </div>
            )}

            <h3 className="diary-side-title" title={titleText}>
              {titleText}
            </h3>

            <div className="meta-row compact">
              <span className="diary-time-pill">
                <Clock3 size={14} />
                {timeText}
              </span>
              <span className="diary-place-pill">
                <MapPin size={14} />
                {locationText}
              </span>
              <span>
                {moodLabels[diary.mood?.type] || diary.mood?.type || '心情'} / {diary.mood?.intensity || '-'}
              </span>
              <span>
                <VisibilityIcon size={14} />
                {visibilityLabels[diary.visibility] || diary.visibility}
              </span>
            </div>

            <p className="diary-side-text">{diary.text || diary.content}</p>

            {isOwner && (
              <button className="danger-button" onClick={() => onDelete(diary._id)}>
                <Trash2 size={16} />
                刪除日記
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

function formatDiaryDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}/${month}/${day} ${hour}:${minute}`;
}

