import { motion } from 'framer-motion';
import { ImagePlus, LocateFixed, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MOOD_OPTIONS, VISIBILITY_OPTIONS } from '../constants/app.js';
import { formatCoordinates, resolvePlaceName } from '../utils/placeName.js';

export default function DiaryModal({ location, onClose, onSubmit, loading, error }) {
  const [form, setForm] = useState({
    title: '',
    text: '',
    moodType: 'calm',
    moodIntensity: 3,
    visibility: 'private',
    image: null
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [placeName, setPlaceName] = useState('');

  useEffect(() => {
    let cancelled = false;
    const lat = Number(location.lat);
    const lng = Number(location.lng);

    setPlaceName(location.placeName || formatCoordinates(lat, lng));

    if (location.source === 'ip') {
      return undefined;
    }

    resolvePlaceName(lat, lng).then((name) => {
      if (!cancelled) setPlaceName(name);
    });

    return () => {
      cancelled = true;
    };
  }, [location.lat, location.lng, location.placeName, location.source]);

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

    const data = new FormData();
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

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        className="diary-modal glass"
        onSubmit={submit}
        initial={{ opacity: 0, y: 48, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.98 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <header>
          <div>
            <p className="eyebrow">New memory</p>
            <h2>新增日記</h2>
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
          <label>
            心情
            <select
              value={form.moodType}
              onChange={(event) => updateField('moodType', event.target.value)}
            >
              {MOOD_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

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
          <label>
            可見性
            <select
              value={form.visibility}
              onChange={(event) => updateField('visibility', event.target.value)}
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

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
        </div>

        <p className="location-line">
          <LocateFixed size={16} />
          {placeName || formatCoordinates(Number(location.lat), Number(location.lng))}
          {location.accuracyType === 'approximate' && ' · 目前為大略位置'}
          {Number.isFinite(location.accuracy) && ` · ±${Math.round(location.accuracy)}m`}
        </p>

        {error && <p className="form-error">{error}</p>}

        <button className="primary-button" type="submit" disabled={loading}>
          {loading && <span className="button-spinner dark" />}
          {loading ? '保存中...' : '保存日記'}
        </button>
      </motion.form>
    </motion.div>
  );
}
