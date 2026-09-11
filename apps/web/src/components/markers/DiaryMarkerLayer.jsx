import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import mapboxgl from 'mapbox-gl';
import DiaryMarkerVisual, { MarkerTooltipContext } from './DiaryMarkerVisual.jsx';
import DiaryStackExpansion from './DiaryStackExpansion.jsx';
import { groupDiaryMarkers } from './markerGeometry.js';
import { getMapObstacles, getStackLayout, groupProjectedMarkers, projectGroup } from './markerLayout.js';
import { clearDiaryMarkers, reconcileDiaryMarkers } from './diaryMarkerRegistry.js';

export default function DiaryMarkerLayer({ map, diaries, geographicGroups, visible = true, theme, selectedId, selectionToken, onSelect, reducedMotion = false }) {
  const entriesRef = useRef(new Map());
  const previousGeo = useRef([]);
  const previousScreen = useRef([]);
  const openedRef = useRef(null);
  const [hosts, setHosts] = useState([]);
  const [cameraRevision, setCameraRevision] = useState(0);
  const [, setPositionRevision] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const tooltipState = useMemo(() => ({ activeTooltip, setActiveTooltip }), [activeTooltip]);
  const groups = useMemo(() => geographicGroups || groupDiaryMarkers(diaries, previousGeo.current), [diaries, geographicGroups]);
  const projected = useMemo(() => map ? groupProjectedMarkers(groups, (center) => projectGroup(map, center), previousScreen.current) : [], [groups, map, cameraRevision]);
  const projectedByKey = useMemo(() => new Map(projected.map((group) => [group.groupKey, group])), [projected]);
  const anchorRecords = useMemo(() => groups.map((group) => ({ _id: group.groupKey, location: group.center })), [groups]);
  const opened = expanded && projected.find((group) => group.isStack && group.memberKeys.includes(expanded.key));
  const hasSelection = Boolean(selectedId);
  // Keep fan offsets fixed during a gesture; only its geographic center moves.
  const openedLayout = useMemo(() => {
    if (!map || !opened) return null;
    const viewport = map.getContainer().getBoundingClientRect();
    const point = projectGroup(map, opened.center);
    return getStackLayout(opened.count, { x: viewport.left + point.x, y: viewport.top + point.y }, viewport, getMapObstacles(map));
  }, [map, opened, cameraRevision, hasSelection]);

  useLayoutEffect(() => {
    previousGeo.current = groups;
    previousScreen.current = projected;
    openedRef.current = opened;
  }, [groups, projected, opened]);

  const close = useCallback((restoreFocus = false) => {
    const key = openedRef.current?.groupKey;
    setExpanded(null);
    if (restoreFocus && key) entriesRef.current.get(key)?.element.querySelector('.dn-hit')?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const entries = entriesRef.current;
    return () => clearDiaryMarkers(entries);
  }, [map]);

  useEffect(() => {
    if (!map) return;
    setHosts(reconcileDiaryMarkers(entriesRef.current, anchorRecords, {
      map, Marker: mapboxgl.Marker, visible,
      createElement() {
        const element = document.createElement('div');
        element.className = 'diary-node-anchor dn-theme';
        element.addEventListener('click', (event) => event.stopPropagation());
        element.addEventListener('keydown', (event) => event.stopPropagation());
        return element;
      }
    }));
  }, [anchorRecords, map, visible]);

  useLayoutEffect(() => {
    for (const { id, element } of hosts) {
      const group = projectedByKey.get(id);
      element.hidden = !visible || !group;
      element.dataset.groupKey = id;
      element.dataset.diaryId = group?.count === 1 ? String(group.diaries[0]._id) : '';
      element.dataset.theme = theme;
      element.dataset.reducedMotion = String(reducedMotion);
      element.dataset.selected = String(Boolean(selectedId) && Boolean(group?.diaries.some((diary) => String(diary._id) === String(selectedId))));
      element.dataset.expanded = String(opened?.groupKey === id);
    }
  }, [hosts, projectedByKey, selectedId, theme, visible, opened, reducedMotion]);

  useEffect(() => {
    if (!map) return;
    let positionFrame = 0;
    let groupingFrame = 0;
    function position() {
      if (!openedRef.current || positionFrame) return;
      positionFrame = requestAnimationFrame(() => { positionFrame = 0; setPositionRevision((value) => value + 1); });
    }
    function regroup() {
      if (groupingFrame) return;
      groupingFrame = requestAnimationFrame(() => { groupingFrame = 0; setCameraRevision((value) => value + 1); });
    }
    const container = map.getContainer();
    const observer = new ResizeObserver(() => { map.resize(); regroup(); position(); });
    observer.observe(container);
    function escape(event) {
      if (event.key === 'Escape' && openedRef.current && (container.contains(event.target) || event.target.closest('.dn-stack-overlay'))) {
        event.preventDefault(); event.stopPropagation(); close(true);
      }
    }
    const blank = () => close();
    map.on('move', position);
    map.on('moveend', regroup);
    map.on('resize', regroup);
    map.on('click', blank);
    window.addEventListener('scroll', position, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      observer.disconnect(); cancelAnimationFrame(positionFrame); cancelAnimationFrame(groupingFrame);
      map.off('move', position); map.off('moveend', regroup); map.off('resize', regroup); map.off('click', blank);
      window.removeEventListener('scroll', position, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [map, close]);

  useEffect(() => { setPendingSelection(selectedId ? String(selectedId) : null); }, [selectedId, selectionToken]);
  useEffect(() => {
    if (!pendingSelection || !visible) return;
    const group = projected.find((item) => item.diaries.some((diary) => String(diary._id) === pendingSelection));
    if (group) {
      const geographic = groups.find((item) => item.diaries.some((diary) => String(diary._id) === pendingSelection));
      setExpanded(group.isStack ? { key: geographic.groupKey, keyboard: false } : null);
      setPendingSelection(null);
    }
  }, [pendingSelection, projected, groups, visible]);
  useEffect(() => {
    if (expanded && !opened) setExpanded(null);
  }, [expanded, opened]);

  let overlay = null;
  if (map && opened && visible) {
    const viewport = map.getContainer().getBoundingClientRect();
    const point = projectGroup(map, opened.center);
    const center = { x: viewport.left + point.x, y: viewport.top + point.y };
    if (point.x >= 0 && point.y >= 0 && point.x <= viewport.width && point.y <= viewport.height) {
      overlay = <div className="dn-stack-overlay dn-theme" data-theme={theme} data-reduced-motion={reducedMotion} style={{ left: center.x, top: center.y }} key={opened.groupKey}>
        <DiaryStackExpansion group={opened} layout={openedLayout} selectedId={selectedId} onSelect={onSelect} onClose={close} keyboardOpen={expanded.keyboard} reducedMotion={reducedMotion}/>
      </div>;
    }
  }

  return <MarkerTooltipContext.Provider value={tooltipState}>
    {hosts.map(({ id, element }) => {
      const group = projectedByKey.get(id);
      if (!group) return null;
      const selected = Boolean(selectedId) && group.diaries.some((diary) => String(diary._id) === String(selectedId));
      return createPortal(<DiaryMarkerVisual diary={group.diaries[0]} count={group.count} selected={selected}
        expanded={opened?.groupKey === id} dimmed={Boolean(selectedId) && !selected}
        onSelect={(event) => {
          if (group.isStack) setExpanded((current) => current && group.memberKeys.includes(current.key) ? null : { key: id, keyboard: event.detail === 0 });
          else { close(); onSelect(group.diaries[0]); }
        }} />, element, id);
    })}
    {createPortal(<AnimatePresence>{overlay}</AnimatePresence>, document.body)}
  </MarkerTooltipContext.Provider>;
}
