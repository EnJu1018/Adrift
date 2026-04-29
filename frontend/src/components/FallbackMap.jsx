import { motion } from 'framer-motion';

export default function FallbackMap({ diaries, selectedId, onSelect }) {
  return (
    <div className="fallback-map">
      <div className="map-grid" />
      {diaries.map((diary, index) => {
        const [lng, lat] = diary.location.coordinates;
        const x = ((lng + 180) / 360) * 100;
        const y = (1 - (lat + 90) / 180) * 100;

        return (
          <motion.button
            key={diary._id}
            className={`marker-button ${selectedId === diary._id ? 'selected' : ''}`}
            style={{ left: `${Math.min(94, Math.max(6, x))}%`, top: `${Math.min(90, Math.max(10, y))}%` }}
            onClick={() => onSelect(diary)}
            initial={{ opacity: 0, scale: 0, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: index * 0.08, type: 'spring', stiffness: 420, damping: 16 }}
            aria-label="Open diary"
          >
            <span />
          </motion.button>
        );
      })}
    </div>
  );
}
