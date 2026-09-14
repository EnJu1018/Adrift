import { createContext, useContext, useId, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { getMoodMarkerStyle } from '../../constants/moodStyles.js';
import { markerTitle, markerMood, markerTime } from './markerText.js';
import './diaryMarkerVisual.css';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';

export const MarkerTooltipContext = createContext(null);

export function DiaryMarkerTooltip({ diary, count = 1, id }) {
  return (
    <span className="dn-tooltip" id={id} role="tooltip">
      <strong>{count > 1 ? `這裡有 ${count} 篇日記` : markerTitle(diary)}</strong>
      <span>{count > 1 ? '選擇記憶' : `${markerMood(diary?.mood?.type)} · ${markerTime(diary?.createdAt)}`}</span>
    </span>
  );
}

// This is an inner visual, never the element passed to Mapbox Marker.
export default function DiaryMarkerVisual({ diary, count = 1, selected = false, expanded = false, dimmed = false, onSelect }) {
  const tooltipId = useId();
  const tooltipState = useContext(MarkerTooltipContext);
  const nodeRef = useRef(null);
  const stack = count > 1;
  const mood = getMoodMarkerStyle(diary?.mood?.type);
  function placeTooltip() {
    tooltipState?.setActiveTooltip(tooltipId);
    const node = nodeRef.current;
    const tooltip = node?.querySelector('.dn-tooltip');
    if (!tooltip) return;
    const bounds = node.closest('.mapboxgl-map')?.getBoundingClientRect()
      || { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    tooltip.style.setProperty('--dn-tooltip-offset', '0px');
    tooltip.dataset.below = 'false';
    const rect = tooltip.getBoundingClientRect();
    const left = Math.max(bounds.left + 8, Math.min(rect.left, bounds.right - rect.width - 8));
    tooltip.style.setProperty('--dn-tooltip-offset', `${left - rect.left}px`);
    tooltip.dataset.below = String(rect.top < bounds.top + 8);
  }
  function hideTooltip() {
    tooltipState?.setActiveTooltip((current) => current === tooltipId ? null : current);
  }
  return (
    <div ref={nodeRef} className="dn-node" data-tooltip={tooltipState ? tooltipState.activeTooltip === tooltipId : undefined} data-selected={selected} data-expanded={expanded} data-dimmed={dimmed} data-stack={stack} data-approximate={diary?.locationAccuracy === 'approximate'} style={{ '--dn-mood': mood.color }}>
      <button type="button" className="dn-hit" onClick={(event) => { hideTooltip(); onSelect?.(event); }}
        onPointerEnter={(event) => { if (event.pointerType !== 'touch') placeTooltip(); }}
        onFocus={(event) => { if (event.target.matches(':focus-visible')) placeTooltip(); }}
        onPointerLeave={hideTooltip} onBlur={hideTooltip}
        onKeyDown={(event) => { if (event.key === 'Escape') hideTooltip(); }}
        aria-label={stack ? `${count} 篇日記` : `查看日記：${markerTitle(diary)}`}
        aria-pressed={stack ? undefined : selected} aria-expanded={stack ? expanded : undefined} aria-describedby={tooltipId}>
        <span className="dn-aura" aria-hidden="true" />
        <span className="dn-focus" aria-hidden="true" />
        {stack && <><span className="dn-layer dn-layer-back" aria-hidden="true" /><span className="dn-layer dn-layer-front" aria-hidden="true" /></>}
        <span className="dn-core" aria-hidden="true">
          <span className="dn-glass" />
          {stack ? <span className="dn-count"><AnimatedNumber value={count > 999 ? '999+' : count} digits={3} /></span> : <Sparkles className="dn-symbol" size={14} strokeWidth={1.7} />}
          <span className="dn-mood-cue" />
        </span>
      </button>
      <DiaryMarkerTooltip id={tooltipId} diary={diary} count={count} />
    </div>
  );
}
