import { getMoodMarkerStyle } from '../constants/moodStyles.js';
import { normalizeDiaryCoordinate } from './markers/markerGeometry.js';

export default function FallbackMap({ diaries, selectedId, currentLocation, onSelect }) {
  const currentPoint = getFallbackPoint(currentLocation);

  return (
    <div className="fallback-map">
      <div className="map-grid" />
      {currentPoint && (
        <div
          className={`current-location-fallback ${currentLocation.accuracyType === 'approximate' ? 'approximate' : ''}`}
          style={{ left: `${currentPoint.x}%`, top: `${currentPoint.y}%` }}
          aria-label={currentLocation.accuracyType === 'approximate' ? '目前為大略位置' : '目前位置'}
        >
          <span />
        </div>
      )}
      {diaries.map((diary) => {
        const coordinates = normalizeDiaryCoordinate(diary);
        if (!coordinates) return null;
        const { lng, lat } = coordinates;
        const x = ((lng + 180) / 360) * 100;
        const y = (1 - (lat + 90) / 180) * 100;
        const markerStyle = getMoodMarkerStyle(diary.mood?.type || 'other', { explore: Boolean(diary.isExplore) });
        const approximate = diary.locationAccuracy === 'approximate';

        return (
          <button
            type="button"
            key={diary._id}
            className={`marker-button diary-memory-marker ${selectedId === diary._id ? 'selected' : ''} ${diary.isExplore ? 'explore' : ''} ${approximate ? 'approximate' : ''}`}
            data-mood={diary.mood?.type || 'other'}
            style={{
              left: `${Math.min(94, Math.max(6, x))}%`,
              top: `${Math.min(90, Math.max(10, y))}%`,
              '--marker-color': markerStyle.color,
              '--marker-glow': markerStyle.glow,
              '--marker-glass': markerStyle.glass,
              '--marker-core': markerStyle.core
            }}
            onClick={() => onSelect(diary)}
            aria-pressed={selectedId === diary._id}
            aria-label={approximate ? '此日記使用大略位置' : '開啟日記'}
          >
            {approximate && <i className="marker-radius" />}
            <span>{markerStyle.icon}</span>
          </button>
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
