import { motion } from 'framer-motion';
import { ImagePlus, LocateFixed, RefreshCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MOOD_OPTIONS, VISIBILITY_OPTIONS } from '../constants/app.js';
import { modalBackdropMotion, modalPopMotion } from '../constants/animations.js';
import { getDistanceInMeters } from '../utils/distance.js';
import { formatCoordinates, resolvePlaceName } from '../utils/placeName.js';
import Select from './ui/Select.jsx';

const moodIcons = {
  calm: '🌿',
  joy: '😊',
  happy: '😊',
  sad: '🌧',
  anxious: '◌',
  wonder: '✨',
  excited: '✨',
  nostalgic: '◐',
  other: '✦'
};

const visibilityIcons = {
  private: '🔒',
  friends: '👥',
  public: '🌐'
};

const moodSelectOptions = MOOD_OPTIONS.map(([value, label]) => ({
  value,
  label,
  icon: moodIcons[value] || moodIcons.other
}));

const visibilitySelectOptions = VISIBILITY_OPTIONS.map((value) => ({
  value,
  label: value,
  icon: visibilityIcons[value]
}));

const EDIT_DISTANCE_LIMIT_METERS = 1000;

export default function DiaryModal({
  location,
  diary = null,
  mode = 'create',
  onClose,
  onSubmit,
  onRefreshLocation,
  loading,
  error
}) {
  const isEditMode = mode === 'edit';
  const [form, setForm] = useState({
    title: diary?.title || '',
    text: diary?.text || diary?.content || '',
    moodType: diary?.mood?.type || 'calm',
    moodIntensity: diary?.mood?.intensity || 3,
    visibility: diary?.visibility || 'private',
    image: null
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [placeName, setPlaceName] = useState('');
  const [timeNow, setTimeNow] = useState(Date.now());
  const [refreshingLocation, setRefreshingLocation] = useState(false);

  const diaryCoordinates = diary?.location?.coordinates || [];
  const diaryLng = Number.isFinite(diaryCoordinates[0]) ? diaryCoordinates[0] : diary?.location?.lng;
  const diaryLat = Number.isFinite(diaryCoordinates[1]) ? diaryCoordinates[1] : diary?.location?.lat;
  const currentLat = Number(location.lat);
  const currentLng = Number(location.lng);
  const editExpiresAt = diary?.editExpiresAt ? new Date(diary.editExpiresAt).getTime() : new Date(diary?.createdAt).getTime() + 60 * 60 * 1000;
  const remainingMs = isEditMode && Number.isFinite(editExpiresAt) ? Math.max(0, editExpiresAt - timeNow) : 0;
  const distanceLimit = diary?.editDistanceLimitMeters || EDIT_DISTANCE_LIMIT_METERS;
  const distanceMeters =
    isEditMode &&
    [diaryLat, diaryLng, currentLat, currentLng].every((value) => Number.isFinite(Number(value)))
      ? getDistanceInMeters(currentLat, currentLng, diaryLat, diaryLng)
      : null;
  const editDistanceAllowed = distanceMeters !== null && distanceMeters <= distanceLimit;
  const editTimeAllowed = !isEditMode || remainingMs > 0;
  const canSubmitEdit = !isEditMode || (editTimeAllowed && editDistanceAllowed);

  useEffect(() => {
    if (!isEditMode || !diary) return;

    setForm({
      title: diary.title || '',
      text: diary.text || diary.content || '',
      moodType: diary.mood?.type || 'calm',
      moodIntensity: diary.mood?.intensity || 3,
      visibility: diary.visibility || 'private',
      image: null
    });
    setFieldErrors({});
  }, [diary?._id, isEditMode]);

  useEffect(() => {
    if (!isEditMode) return undefined;

    const timer = window.setInterval(() => setTimeNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [isEditMode]);

  useEffect(() => {
    let cancelled = false;
    const lat = isEditMode ? Number(diaryLat) : Number(location.lat);
    const lng = isEditMode ? Number(diaryLng) : Number(location.lng);

    setPlaceName((isEditMode ? diary?.location?.placeName : location.placeName) || formatCoordinates(lat, lng));

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!isEditMode && location.source === 'ip')) {
      return undefined;
    }

    resolvePlaceName(lat, lng).then((name) => {
      if (!cancelled) setPlaceName(name);
    });

    return () => {
      cancelled = true;
    };
  }, [diary?.location?.placeName, diaryLat, diaryLng, isEditMode, location.lat, location.lng, location.placeName, location.source]);

  function updateField(field, value) {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    setFieldErrors((current) => ({ ...current, [field]: validateField(field, nextForm) }));
  }

  function validateField(field, values = form) {
    if (field === 'title') {
      const title = values.title.trim();
      if (!title) return '請輸入日記標題';
      if (title.length > 50) return '日記標題最多 50 字';
    }

    if (field === 'text' && !values.text.trim()) {
      return '請輸入日記內容';
    }

    return '';
  }

  function validate() {
    const titleError = validateField('title');
    const textError = validateField('text');
    const errors = {};
    if (titleError) errors.title = titleError;
    if (textError) errors.text = textError;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event) {
    event.preventDefault();

    if (!validate()) return;

    if (isEditMode && !canSubmitEdit) return;

    const data = isEditMode
      ? {
          title: form.title.trim(),
          content: form.text.trim(),
          mood: {
            type: form.moodType,
            intensity: Number(form.moodIntensity)
          },
          visibility: form.visibility,
          currentLocation: {
            lat: currentLat,
            lng: currentLng,
            accuracyType: location.accuracyType === 'approximate' ? 'approximate' : 'precise'
          }
        }
      : new FormData();

    if (!isEditMode) {
      data.append('title', form.title.trim());
      data.append('text', form.text.trim());
      data.append('moodType', form.moodType);
      data.append('moodIntensity', form.moodIntensity);
      data.append('visibility', form.visibility);
      data.append('lat', location.lat);
      data.append('lng', location.lng);
      data.append('placeName', placeName);
      data.append('locationAccuracy', location.accuracyType === 'approximate' ? 'approximate' : 'precise');

      if (Number.isFinite(location.accuracy)) {
        data.append('accuracy', location.accuracy);
      }

      if (form.image) {
        data.append('image', form.image);
      }
    }

    try {
      await onSubmit(data);
      setForm({
        title: '',
        text: '',
        moodType: 'calm',
        moodIntensity: 3,
        visibility: 'private',
        image: null
      });
    } catch {
      // The parent renders API errors inside the modal.
    }
  }

  async function refreshCurrentLocation() {
    if (!onRefreshLocation || refreshingLocation) return;

    try {
      setRefreshingLocation(true);
      await onRefreshLocation();
    } catch {
      // Parent displays the location error in the status strip and modal error area.
    } finally {
      setRefreshingLocation(false);
    }
  }

  return (
    <motion.div className="modal-backdrop" {...modalBackdropMotion}>
      <motion.form
        className="diary-modal glass"
        onSubmit={submit}
        {...modalPopMotion}
      >
        <header>
          <div>
            <p className="eyebrow">{isEditMode ? 'Edit memory' : 'New memory'}</p>
            <h2>{isEditMode ? '編輯日記' : '新增日記'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <label>
          標題
          <input
            value={form.title}
            onChange={(event) => updateField('title', event.target.value.slice(0, 50))}
            placeholder="今天在海邊"
            maxLength={50}
            aria-invalid={Boolean(fieldErrors.title)}
            required
          />
          <small className="field-hint">{form.title.trim().length} / 50</small>
          {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
        </label>

        <label>
          文字
          <textarea
            value={form.text}
            onChange={(event) => updateField('text', event.target.value)}
            placeholder="把此刻的潮汐留下來..."
            rows={5}
            aria-invalid={Boolean(fieldErrors.text)}
            required
          />
          {fieldErrors.text && <span className="field-error">{fieldErrors.text}</span>}
        </label>

        <div className="field-grid">
          <Select
            label="心情"
            value={form.moodType}
            options={moodSelectOptions}
            onChange={(value) => updateField('moodType', value)}
          />

          <label>
            強度 {form.moodIntensity}
            <input
              type="range"
              min="1"
              max="5"
              value={form.moodIntensity}
              onChange={(event) => updateField('moodIntensity', event.target.value)}
            />
          </label>
        </div>

        <div className="field-grid">
          <Select
            label="可見性"
            value={form.visibility}
            options={visibilitySelectOptions}
            onChange={(value) => updateField('visibility', value)}
          />

          {!isEditMode && (
            <label className="file-input">
              圖片
              <span>
                <ImagePlus size={16} />
                {form.image ? form.image.name : '選擇圖片'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => updateField('image', event.target.files?.[0] || null)}
              />
            </label>
          )}
        </div>

        {isEditMode ? (
          <div className="edit-authenticity-box">
            <p>
              Adrift 希望保留日記當下的真實性，因此日記只能在發布後 1 小時內、且仍接近原本地點時修改。
            </p>
            <span>
              <LocateFixed size={15} />
              日記位置不可修改：{placeName || formatCoordinates(Number(diaryLat), Number(diaryLng))}
            </span>
            <span>{remainingMs > 0 ? `剩餘可編輯時間：${formatRemainingTime(remainingMs)}` : '已超過可編輯時間'}</span>
            <span>
              目前距離原位置：{distanceMeters === null ? '無法判斷' : `約 ${formatDistance(distanceMeters)}`}
              {location.accuracyType === 'approximate' && ' · 目前為大略位置，可能影響是否可編輯'}
            </span>
            {!editDistanceAllowed && <strong>你目前距離原日記位置超過 1 公里，無法編輯</strong>}
            {!editTimeAllowed && <strong>日記發布超過 1 小時後無法再編輯</strong>}
            {remainingMs > 0 && remainingMs <= 5 * 60 * 1000 && <strong>可編輯時間即將結束</strong>}
            <button className="chip-button inline-refresh" type="button" onClick={refreshCurrentLocation} disabled={refreshingLocation || loading}>
              {refreshingLocation ? <span className="button-spinner" /> : <RefreshCcw size={14} />}
              更新位置
            </button>
          </div>
        ) : (
          <p className="location-line">
            <LocateFixed size={16} />
            {placeName || formatCoordinates(Number(location.lat), Number(location.lng))}
            {location.accuracyType === 'approximate' && ' · 目前為大略位置'}
            {Number.isFinite(location.accuracy) && ` · ±${Math.round(location.accuracy)}m`}
          </p>
        )}

        {error && <p className="form-error">{error}</p>}

        <button className="primary-button" type="submit" disabled={loading || !canSubmitEdit}>
          {loading && <span className="button-spinner dark" />}
          {loading ? '保存中...' : isEditMode ? '儲存變更' : '保存日記'}
        </button>
      </motion.form>
    </motion.div>
  );
}

function formatRemainingTime(ms) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} 小時 ${minutes} 分鐘`;
  if (hours > 0) return `${hours} 小時`;
  return `${minutes} 分鐘`;
}

function formatDistance(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} 公里`;
  return `${Math.round(value)} 公尺`;
}
