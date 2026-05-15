import { AnimatePresence, motion } from 'framer-motion';
import { Clock3, Edit3, ImageIcon, Lock, MapPin, Trash2, Users, Waves, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getImageUrl } from '../api/client.js';
import { fadeUpMotion, panelSlideLeft } from '../constants/animations.js';
import { FALLBACK_DIARY_TITLE, MOOD_LABELS, REACTION_OPTIONS } from '../constants/app.js';
import { getDistanceInMeters } from '../utils/distance.js';
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

const EDIT_DISTANCE_LIMIT_METERS = 1000;

export default function DiarySidePanel({ diary, currentUser, currentLocation, onClose, onDelete, onReact, onEdit }) {
  const [resolvedPlaceName, setResolvedPlaceName] = useState('');
  const [reactingType, setReactingType] = useState('');
  const [timeNow, setTimeNow] = useState(Date.now());
  const hasDiary = Boolean(diary);
  const VisibilityIcon = hasDiary ? visibilityIcons[diary.visibility] || Waves : Waves;
  const coordinates = diary?.location?.coordinates || [];
  const lng = Number.isFinite(coordinates[0]) ? coordinates[0] : diary?.location?.lng;
  const lat = Number.isFinite(coordinates[1]) ? coordinates[1] : diary?.location?.lat;
  const currentUserId = currentUser?.id || currentUser?._id;
  const diaryUserId = diary?.user?._id || diary?.user?.id || diary?.author?._id;
  const isOwner = Boolean(currentUserId && diaryUserId && currentUserId === diaryUserId.toString());
  const author = diary?.user || diary?.author || {};
  const locationText = resolvedPlaceName || diary?.location?.placeName || formatCoordinates(lat, lng);
  const timeText = hasDiary ? formatDiaryDateTime(diary.createdAt) : '';
  const lastEditedText = diary?.lastEditedAt ? formatDiaryEditedTime(diary.lastEditedAt) : '';
  const titleText = diary?.title?.trim() || FALLBACK_DIARY_TITLE;
  const editStatus = getDiaryEditStatus(diary, isOwner, currentLocation, timeNow);
  const reactionCounts = {
    understand: diary?.reactions?.understand || 0,
    hug: diary?.reactions?.hug || 0,
    relate: diary?.reactions?.relate || 0
  };

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

  useEffect(() => {
    if (!hasDiary || !isOwner) return undefined;

    const timer = window.setInterval(() => setTimeNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [hasDiary, isOwner]);

  async function handleReact(type) {
    if (!diary?._id || !onReact || reactingType) return;

    const optimisticDiary = buildOptimisticReaction(diary, type);

    try {
      setReactingType(type);
      await onReact(diary._id, type, optimisticDiary);
    } catch {
      // Parent shows the API error in the page status strip.
    } finally {
      setReactingType('');
    }
  }

  return (
    <motion.aside
      className="diary-side-panel glass"
      {...panelSlideLeft}
    >
      <AnimatePresence mode="wait">
        {!hasDiary ? (
          <motion.div
            key="empty"
            className="diary-side-empty"
            {...fadeUpMotion}
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
            {...fadeUpMotion}
          >
            <header className="diary-side-header">
              <div className="diary-author-block">
                <p className="eyebrow diary-detail-eyebrow">Selected diary</p>
                <div className="popup-author diary-popup-author-inline">
                  <span className="avatar-orb small">{(author.name || 'A').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <h2>{author.name || 'Unknown'}</h2>
                    <small>@{author.userCode || 'unknown'}</small>
                  </div>
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

            <div className="diary-detail-stack">
              <div className="meta-row compact diary-meta-primary">
                <span className="diary-time-pill">
                  <Clock3 size={14} />
                  {timeText}
                </span>
                {(diary.editCount > 0 || diary.lastEditedAt) && (
                  <span className="diary-edited-pill" title={lastEditedText ? `最後編輯：${lastEditedText}` : '已編輯'}>
                    已編輯{lastEditedText ? ` · ${lastEditedText}` : ''}
                  </span>
                )}
                <span className="diary-place-pill" title={locationText}>
                  <MapPin size={14} />
                  {locationText}
                </span>
              </div>

              <div className="meta-row compact diary-meta-secondary">
                <span>
                  {MOOD_LABELS[diary.mood?.type] || diary.mood?.type || '心情'} / {diary.mood?.intensity || '-'}
                </span>
                <span>
                  <VisibilityIcon size={14} />
                  {visibilityLabels[diary.visibility] || diary.visibility}
                </span>
              </div>

              <section className="diary-mood-section" aria-label="Mood">
                <div className="reaction-row" aria-label="共鳴">
                  {REACTION_OPTIONS.map((reaction) => (
                    <button
                      key={reaction.type}
                      className={`reaction-button ${diary.userReaction === reaction.type ? 'active' : ''}`}
                      onClick={() => handleReact(reaction.type)}
                      disabled={Boolean(reactingType)}
                      title={reaction.label}
                      type="button"
                    >
                      <span>{reaction.icon}</span>
                      <strong>{reactionCounts[reaction.type]}</strong>
                    </button>
                  ))}
                </div>
              </section>

              <h3 className="diary-side-title" title={titleText}>
                {titleText}
              </h3>

              <p className="diary-side-text">{diary.text || diary.content}</p>
            </div>

            {isOwner && (
              <div className="diary-owner-actions">
                <div className={`edit-availability ${editStatus.canEdit ? 'available' : 'locked'}`}>
                  <strong>{editStatus.canEdit ? `可編輯時間剩餘 ${editStatus.remainingText}` : editStatus.reason}</strong>
                  <span>
                    日記只能在發布後 1 小時內，且距離原位置 1 公里內編輯。
                  </span>
                  {currentLocation?.accuracyType === 'approximate' && <span>目前為大略位置，可能影響是否可編輯。</span>}
                </div>
                <button className="secondary-button edit-diary-button" onClick={() => onEdit?.(diary)} disabled={!editStatus.canEdit && !editStatus.needsLocation}>
                  <Edit3 size={16} />
                  編輯日記
                </button>
                <button className="danger-button" onClick={() => onDelete(diary._id)}>
                  <Trash2 size={16} />
                  刪除日記
                </button>
              </div>
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

function formatDiaryEditedTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getDiaryEditStatus(diary, isOwner, currentLocation, timeNow) {
  if (!diary || !isOwner) {
    return { canEdit: false, reason: '' };
  }

  const expiresAt = diary.editExpiresAt ? new Date(diary.editExpiresAt).getTime() : new Date(diary.createdAt).getTime() + 60 * 60 * 1000;
  const remainingMs = Number.isFinite(expiresAt) ? expiresAt - timeNow : 0;

  if (!diary.canEdit || remainingMs <= 0) {
    return { canEdit: false, reason: '已超過可編輯時間' };
  }

  const coordinates = diary.location?.coordinates || [];
  const diaryLng = Number.isFinite(coordinates[0]) ? coordinates[0] : diary.location?.lng;
  const diaryLat = Number.isFinite(coordinates[1]) ? coordinates[1] : diary.location?.lat;
  const currentLat = Number(currentLocation?.lat);
  const currentLng = Number(currentLocation?.lng);

  if (![diaryLat, diaryLng, currentLat, currentLng].every((value) => Number.isFinite(Number(value)))) {
    return { canEdit: false, needsLocation: true, reason: '取得目前位置後可檢查距離' };
  }

  const distance = getDistanceInMeters(currentLat, currentLng, diaryLat, diaryLng);
  const limit = diary.editDistanceLimitMeters || EDIT_DISTANCE_LIMIT_METERS;

  if (!Number.isFinite(distance) || distance > limit) {
    return { canEdit: false, reason: '離原地點太遠，無法編輯' };
  }

  return {
    canEdit: true,
    reason: '',
    distance,
    remainingText: formatRemainingTime(remainingMs)
  };
}

function formatRemainingTime(ms) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} 小時 ${minutes} 分鐘`;
  if (hours > 0) return `${hours} 小時`;
  return `${minutes} 分鐘`;
}

function buildOptimisticReaction(diary, type) {
  const currentType = diary.userReaction || null;
  const reactions = {
    understand: diary.reactions?.understand || 0,
    hug: diary.reactions?.hug || 0,
    relate: diary.reactions?.relate || 0
  };

  let userReaction = type;

  if (currentType === type) {
    reactions[type] = Math.max(0, reactions[type] - 1);
    userReaction = null;
  } else {
    if (currentType) reactions[currentType] = Math.max(0, reactions[currentType] - 1);
    reactions[type] += 1;
  }

  return {
    ...diary,
    reactions,
    userReaction
  };
}
