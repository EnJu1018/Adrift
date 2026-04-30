import { motion } from 'framer-motion';
import { Lock, Trash2, Users, Waves, X } from 'lucide-react';
import { getImageUrl } from '../api/client.js';

const visibilityIcons = {
  private: Lock,
  friends: Users,
  public: Waves
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

export default function DiaryPopup({ diary, currentUser, onClose, onDelete }) {
  const VisibilityIcon = visibilityIcons[diary.visibility] || Waves;
  const [lng, lat] = diary.location.coordinates;
  const currentUserId = currentUser?.id;
  const diaryUserId = diary.user?._id || diary.user?.id;
  const isOwner = Boolean(currentUserId && diaryUserId && currentUserId === diaryUserId.toString());

  return (
    <motion.aside
      className="popup-card glass"
      initial={{ opacity: 0, y: 60, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <header>
        <div className="popup-author">
          <span className="avatar-orb small">{(diary.user?.name || 'A').slice(0, 1).toUpperCase()}</span>
          <div>
            <p className="eyebrow">{new Date(diary.createdAt).toLocaleString()}</p>
            <h2>{diary.title?.trim() || '（未命名日記）'}</h2>
            <small>@{diary.user?.userCode || 'unknown'}</small>
          </div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close diary">
          <X size={18} />
        </button>
      </header>

      {diary.imageUrl && <img className="diary-image" src={getImageUrl(diary.imageUrl)} alt="" />}

      <p className="diary-text">{diary.text || diary.content}</p>

      <div className="meta-row">
        <span>
          {moodLabels[diary.mood.type] || diary.mood.type} / {diary.mood.intensity}
        </span>
        <span>
          <VisibilityIcon size={15} />
          {diary.visibility}
        </span>
        <span>
          {lat.toFixed(3)}, {lng.toFixed(3)}
        </span>
        {Number.isFinite(diary.locationAccuracy) && <span>±{Math.round(diary.locationAccuracy)}m</span>}
      </div>

      {isOwner && (
        <button className="danger-button" onClick={() => onDelete(diary._id)}>
          <Trash2 size={16} />
          刪除日記
        </button>
      )}
    </motion.aside>
  );
}
