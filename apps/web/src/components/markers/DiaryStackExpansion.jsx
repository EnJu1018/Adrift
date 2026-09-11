import { useEffect, useRef } from 'react';
import { motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { motionTokens } from '../../constants/animations.js';
import DiaryMarkerVisual from './DiaryMarkerVisual.jsx';
import { markerTitle, markerMood, markerTime } from './markerText.js';

export default function DiaryStackExpansion({ group, layout, selectedId, onSelect, onClose, keyboardOpen, reducedMotion }) {
  const present = useIsPresent();
  const systemReducedMotion = useReducedMotion();
  const ref = useRef(null);
  const quiet = reducedMotion || systemReducedMotion;
  const transition = { duration: quiet ? 0 : present ? motionTokens.duration.fast : motionTokens.duration.quick, ease: motionTokens.ease.smoothOut };

  useEffect(() => {
    if (keyboardOpen) ref.current?.querySelector('button[aria-pressed="true"], [data-stack-choice] button, button[data-stack-choice]')?.focus({ preventScroll: true });
  }, [keyboardOpen]);

  useEffect(() => {
    if (layout.kind === 'list') ref.current?.querySelector('button[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [selectedId, layout.kind]);

  function handleKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const items = [...ref.current.querySelectorAll('[data-stack-choice] button, button[data-stack-choice]')];
    const current = items.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (current + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1) + items.length) % items.length;
    items[next]?.focus({ preventScroll: layout.kind === 'arc' });
  }

  return <motion.div ref={ref} className={`dn-expansion dn-expansion-${layout.kind}`} role="dialog" aria-label={`${group.count} 篇記憶`} aria-modal="false"
    inert={!present ? true : undefined} aria-hidden={!present || undefined} onKeyDown={handleKey}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
    {layout.kind === 'arc' ? <>
      <svg className="dn-connectors" width="1" height="1" aria-hidden="true">
        {layout.items.map(({ x, y }, index) => <line key={group.diaries[index]._id} x1="0" y1="0" x2={x} y2={y} />)}
      </svg>
      {group.diaries.map((diary, index) => <motion.div className="dn-arc-item" key={diary._id} data-stack-choice={diary._id}
        initial={{ x: 0, y: 0, opacity: 0, scale: 0.9 }}
        animate={{ ...layout.items[index], opacity: 1, scale: 1 }} exit={{ x: 0, y: 0, opacity: 0, scale: 0.9 }}
        transition={{ ...transition, delay: quiet || !present ? 0 : index * motionTokens.duration.stagger }}>
        <DiaryMarkerVisual diary={diary} selected={String(diary._id) === String(selectedId)} onSelect={() => onSelect(diary)} />
      </motion.div>)}
    </> : <motion.div className="dn-stack-list" style={{ width: layout.width, maxHeight: layout.height }}
      initial={{ x: layout.x, y: layout.y, scale: 0.98 }} animate={{ x: layout.x, y: layout.y, scale: 1 }} exit={{ scale: 0.98 }} transition={transition}>
      <header><strong>{group.count} 篇記憶</strong><button type="button" onClick={() => onClose(true)} aria-label="收合記憶清單"><X size={18}/></button></header>
      <div className="dn-stack-scroll">
        {group.diaries.map((diary) => <button type="button" key={diary._id} data-stack-choice={diary._id}
          aria-pressed={String(diary._id) === String(selectedId)} onClick={() => onSelect(diary)}>
          <span><strong>{markerTitle(diary)}</strong><small>{markerMood(diary.mood?.type)} · {markerTime(diary.createdAt)}</small></span>
          {String(diary._id) === String(selectedId) && <Check size={16} aria-hidden="true"/>}
        </button>)}
      </div>
    </motion.div>}
  </motion.div>;
}
