import { motion } from 'framer-motion';
import { getMoodMarkerStyle } from '../constants/moodStyles.js';

export default function FallbackMap({ diaries, selectedId, currentLocation, onSelect }) {
  const currentPoint = getFallbackPoint(currentLocation);

  return (
    <div className="fallback-map">
      <div className="map-grid" />
      {currentPoint && (
        <motion.div
          className={`current-location-fallback ${currentLocation.accuracyType === 'approximate' ? 'approximate' : ''}`}
          style={{ left: `${currentPoint.x}%`, top: `${currentPoint.y}%` }}
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          title={currentLocation.accuracyType === 'approximate' ? '目前為大略位置' : '目前位置'}
        >
          <span />
        </motion.div>
      )}
      {diaries.map((diary, index) => {
        const [lng, lat] = diary.location.coordinates;
        const x = ((lng + 180) / 360) * 100;
        const y = (1 - (lat + 90) / 180) * 100;
        const markerStyle = getMoodMarkerStyle(diary.mood?.type || 'other', { explore: Boolean(diary.isExplore) });
        const approximate = diary.locationAccuracy === 'approximate';

        return (
          <motion.button
            key={diary._id}
            className={`marker-button diary-memory-marker ${selectedId === diary._id ? 'selected' : ''} ${diary.isExplore ? 'explore' : ''} ${approximate ? 'approximate' : ''}`}
            data-mood={diary.mood?.type || 'other'}
            style={{ left: `${Math.min(94, Math.max(6, x))}%`, top: `${Math.min(90, Math.max(10, y))}%` }}
            onClick={() => onSelect(diary)}
            initial={{ opacity: 0, scale: 0, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: index * 0.08, type: 'spring', stiffness: 420, damping: 16 }}
            aria-label="Open diary"
            title={approximate ? '此日記使用大略位置' : '開啟日記'}
          >
            {approximate && <i className="marker-radius" />}
            <span
              style={{
                '--marker-color': markerStyle.color,
                '--marker-glow': markerStyle.glow,
                '--marker-glass': markerStyle.glass,
                '--marker-core': markerStyle.core
              }}
            >
              {markerStyle.icon}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function getFallbackPoint(location) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    x: Math.min(94, Math.max(6, ((lng + 180) / 360) * 100)),
    y: Math.min(90, Math.max(10, (1 - (lat + 90) / 180) * 100))
  };
}
