import mapboxgl from 'mapbox-gl';
import { AnimatePresence, motion } from 'framer-motion';
import { Compass, Minus, Navigation, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fadeUpMotion, pageTransition, toastMotion } from '../constants/animations.js';
import { getMoodMarkerStyle } from '../constants/moodStyles.js';
import FallbackMap from './FallbackMap.jsx';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const mapStyles = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  bright: 'mapbox://styles/mapbox/streets-v12'
};
const OVERLAP_GROUP_DISTANCE_METERS = 20;

export default function MapView({
  diaries,
  selectedDiary,
  onSelect,
  onViewportChange,
  focusLocation,
  currentLocation,
  mode = 'mine',
  expanded,
  loading,
  locating = false,
  onLocateUser,
  disabled,
  lowPerformance = false,
  reducedMotion = false,
  theme = 'dark'
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const moveTimerRef = useRef(null);
  const tooltipRef = useRef(null);
  const htmlMarkersRef = useRef(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [mapPitch, setMapPitch] = useState(0);
  const [mapBearing, setMapBearing] = useState(0);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [hoveredDiaryId, setHoveredDiaryId] = useState(null);
  const [expandedGroupKey, setExpandedGroupKey] = useState(null);
  const [htmlMarkerMode, setHtmlMarkerMode] = useState(false);
  const diariesById = useMemo(() => {
    return new Map((diaries || []).map((diary) => [diary._id, diary]));
  }, [diaries]);
  const diaryGroupMeta = useMemo(() => buildDiaryGroupMeta(diaries || []), [diaries]);

  const geoJson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: buildDiaryFeatures(diaries || [], selectedDiary?._id, hoveredDiaryId, theme)
    };
  }, [diaries, hoveredDiaryId, selectedDiary?._id, theme]);

  const currentLocationGeoJson = useMemo(() => {
    const lat = Number(currentLocation?.lat);
    const lng = Number(currentLocation?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        type: 'FeatureCollection',
        features: []
      };
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            approximate: currentLocation.accuracyType === 'approximate',
            source: currentLocation.source || 'browser'
          },
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        }
      ]
    };
  }, [currentLocation?.accuracyType, currentLocation?.lat, currentLocation?.lng, currentLocation?.source]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current || !mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyles[theme] || mapStyles.dark,
      center: [121.5654, 25.033],
      zoom: 3.2,
      attributionControl: false
    });

    mapRef.current = map;

    map.on('load', () => {
      tuneBaseMapStyle(map, theme);

      map.addSource('diaries', {
        type: 'geojson',
        data: geoJson,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 54
      });

      map.addSource('current-location', {
        type: 'geojson',
        data: currentLocationGeoJson
      });

      map.addLayer({
        id: 'diary-cluster-glow',
        type: 'circle',
        source: 'diaries',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#38d9c5',
            10,
            '#38bdf8',
            40,
            '#a78bfa'
          ],
          'circle-radius': ['step', ['get', 'point_count'], 22, 10, 28, 40, 34],
          'circle-opacity': 0.2,
          'circle-blur': 0.5,
          'circle-emissive-strength': 1
        }
      });

      map.addLayer({
        id: 'diary-clusters',
        type: 'circle',
        source: 'diaries',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#34d399',
            10,
            '#38bdf8',
            40,
            '#a78bfa'
          ],
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 40, 24],
          'circle-stroke-color': 'rgba(238, 252, 255, 0.78)',
          'circle-stroke-width': 1.4,
          'circle-opacity': 0.82,
          'circle-blur': 0,
          'circle-emissive-strength': 1
        }
      });

      map.addLayer({
        id: 'diary-cluster-count',
        type: 'symbol',
        source: 'diaries',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': ['step', ['get', 'point_count'], 13, 10, 14, 40, 15]
        },
        paint: {
          'text-color': '#eefcff',
          'text-halo-color': 'rgba(4, 12, 24, 0.72)',
          'text-halo-width': 1.1,
          'text-emissive-strength': 1
        }
      });

      map.addLayer({
        id: 'diary-approximate-areas',
        type: 'circle',
        source: 'diaries',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['==', ['get', 'approximate'], true],
          ['any', ['==', ['get', 'overlapCount'], 1], ['==', ['get', 'stackRoot'], true]]
        ],
        paint: {
          'circle-color': 'rgba(125, 211, 252, 0.12)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 18, 8, 38, 12, 88, 16, 170],
          'circle-stroke-color': 'rgba(186, 244, 255, 0.42)',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 12, 1.3, 16, 1.8],
          'circle-opacity': 0.72,
          'circle-blur': 0.42
        }
      });

      map.addLayer({
        id: 'diary-marker-hitbox',
        type: 'circle',
        source: 'diaries',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['any', ['==', ['get', 'overlapCount'], 1], ['==', ['get', 'stackRoot'], true]]
        ],
        paint: {
          'circle-color': 'rgba(255, 255, 255, 0.01)',
          'circle-radius': ['case', ['>', ['get', 'overlapCount'], 1], 24, 21],
          'circle-opacity': 0.01
        }
      });

      map.addLayer({
        id: 'diary-marker-glow',
        type: 'circle',
        source: 'diaries',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['any', ['==', ['get', 'overlapCount'], 1], ['==', ['get', 'stackRoot'], true]]
        ],
        layout: {
          'circle-sort-key': ['case', ['boolean', ['get', 'selected'], false], 3, ['boolean', ['get', 'hovered'], false], 2, 1]
        },
        paint: {
          'circle-color': ['get', 'markerHaloColor'],
          'circle-radius': [
            'case',
            ['boolean', ['get', 'selected'], false],
            28,
            ['boolean', ['get', 'hovered'], false],
            24,
            ['>', ['get', 'overlapCount'], 1],
            25,
            ['boolean', ['get', 'approximate'], false],
            21,
            20
          ],
          'circle-opacity': [
            'case',
            ['boolean', ['get', 'selected'], false],
            0.54,
            ['boolean', ['get', 'hovered'], false],
            0.47,
            ['boolean', ['get', 'approximate'], false],
            0.34,
            0.4
          ],
          'circle-blur': 0.5,
          'circle-emissive-strength': 1
        }
      });

      map.addLayer({
        id: 'diary-marker-shell',
        type: 'circle',
        source: 'diaries',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['any', ['==', ['get', 'overlapCount'], 1], ['==', ['get', 'stackRoot'], true]]
        ],
        layout: {
          'circle-sort-key': ['case', ['boolean', ['get', 'selected'], false], 3, ['boolean', ['get', 'hovered'], false], 2, 1]
        },
        paint: {
          'circle-color': ['get', 'markerShellColor'],
          'circle-radius': [
            'case',
            ['boolean', ['get', 'selected'], false],
            15.2,
            ['boolean', ['get', 'hovered'], false],
            14.2,
            ['>', ['get', 'overlapCount'], 1],
            14.8,
            ['boolean', ['get', 'approximate'], false],
            12.8,
            12.6
          ],
          'circle-stroke-color': [
            'case',
            ['boolean', ['get', 'selected'], false],
            ['get', 'markerFocusColor'],
            ['get', 'markerStrokeColor']
          ],
          'circle-stroke-width': [
            'case',
            ['boolean', ['get', 'selected'], false],
            2.6,
            ['boolean', ['get', 'hovered'], false],
            2.2,
            ['>', ['get', 'overlapCount'], 1],
            2.2,
            ['boolean', ['get', 'approximate'], false],
            1.5,
            1.8
          ],
          'circle-opacity': ['case', ['boolean', ['get', 'approximate'], false], 0.72, 0.94],
          'circle-stroke-opacity': ['case', ['boolean', ['get', 'approximate'], false], 0.68, 0.95],
          'circle-blur': ['case', ['boolean', ['get', 'approximate'], false], 0.04, 0],
          'circle-emissive-strength': 1,
          'circle-radius-transition': { duration: 180 },
          'circle-opacity-transition': { duration: 180 }
        }
      });

      map.addLayer({
        id: 'diary-marker-core',
        type: 'circle',
        source: 'diaries',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['any', ['==', ['get', 'overlapCount'], 1], ['==', ['get', 'stackRoot'], true]]
        ],
        layout: {
          'circle-sort-key': ['case', ['boolean', ['get', 'selected'], false], 3, ['boolean', ['get', 'hovered'], false], 2, 1]
        },
        paint: {
          'circle-color': ['get', 'markerColor'],
          'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 5.8, ['>', ['get', 'overlapCount'], 1], 5.2, 4.4],
          'circle-opacity': ['case', ['boolean', ['get', 'approximate'], false], 0.62, 0.88],
          'circle-blur': 0,
          'circle-emissive-strength': 1
        }
      });

      map.addLayer({
        id: 'diary-marker-glyph',
        type: 'symbol',
        source: 'diaries',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['any', ['==', ['get', 'overlapCount'], 1], ['==', ['get', 'stackRoot'], true]]
        ],
        layout: {
          'text-field': ['get', 'markerGlyph'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': ['case', ['boolean', ['get', 'selected'], false], 15, 13],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'symbol-sort-key': ['case', ['boolean', ['get', 'selected'], false], 3, ['boolean', ['get', 'hovered'], false], 2, 1]
        },
        paint: {
          'text-color': ['get', 'markerGlyphColor'],
          'text-halo-color': ['get', 'markerGlyphHaloColor'],
          'text-halo-width': 0.8,
          'text-emissive-strength': 1
        }
      });

      map.addLayer({
        id: 'diary-stack-count',
        type: 'symbol',
        source: 'diaries',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['>', ['get', 'overlapCount'], 1],
          ['==', ['get', 'stackRoot'], true]
        ],
        layout: {
          'text-field': ['to-string', ['get', 'overlapCount']],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 10,
          'text-offset': [1.05, -1.05],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'symbol-sort-key': 4
        },
        paint: {
          'text-color': ['get', 'stackCountTextColor'],
          'text-halo-color': ['get', 'stackCountHaloColor'],
          'text-halo-width': 1.4,
          'text-emissive-strength': 1
        }
      });

      map.addLayer({
        id: 'diary-selected-ring',
        type: 'circle',
        source: 'diaries',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['any', ['==', ['get', 'overlapCount'], 1], ['==', ['get', 'stackRoot'], true]],
          ['any', ['==', ['get', 'selected'], true], ['==', ['get', 'hovered'], true], ['==', ['get', 'expanded'], true]]
        ],
        paint: {
          'circle-color': 'rgba(255, 255, 255, 0)',
          'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 19.2, ['==', ['get', 'expanded'], true], 17.8, 15.8],
          'circle-stroke-color': ['get', 'markerFocusColor'],
          'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 2.1, 1.4],
          'circle-stroke-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.82, 0.5],
          'circle-blur': 0.08,
          'circle-emissive-strength': 1
        }
      });

      map.addLayer({
        id: 'current-location-radius',
        type: 'circle',
        source: 'current-location',
        filter: ['==', ['get', 'approximate'], true],
        paint: {
          'circle-color': 'rgba(59, 130, 246, 0.18)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 14, 8, 36, 12, 86, 16, 180],
          'circle-stroke-color': 'rgba(191, 219, 254, 0.62)',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 12, 1.4, 16, 2],
          'circle-blur': 0.38,
          'circle-emissive-strength': 1
        }
      });

      map.addLayer({
        id: 'current-location-pulse',
        type: 'circle',
        source: 'current-location',
        paint: {
          'circle-color': [
            'case',
            ['boolean', ['get', 'approximate'], false],
            'rgba(96, 165, 250, 0.34)',
            'rgba(14, 165, 233, 0.38)'
          ],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 18, 15, 30],
          'circle-opacity': 0.86,
          'circle-blur': 0.22,
          'circle-emissive-strength': 1
        }
      });

      map.addLayer({
        id: 'current-location-point',
        type: 'circle',
        source: 'current-location',
        paint: {
          'circle-color': [
            'case',
            ['boolean', ['get', 'approximate'], false],
            '#3b82f6',
            '#0ea5e9'
          ],
          'circle-radius': ['case', ['boolean', ['get', 'approximate'], false], 8, 7],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-opacity': ['case', ['boolean', ['get', 'approximate'], false], 0.86, 1],
          'circle-blur': 0,
          'circle-emissive-strength': 1
        }
      });

      setMapReady(true);
    });

    return () => {
      window.clearTimeout(moveTimerRef.current);
      htmlMarkersRef.current.forEach((entry) => entry.marker.remove());
      htmlMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource('diaries');
    source?.setData(geoJson);
  }, [geoJson, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource('current-location');
    source?.setData(currentLocationGeoJson);
  }, [currentLocationGeoJson, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    function updateHtmlMarkerMode() {
      const nextHtmlMarkerMode = map.getZoom() >= 13;
      setHtmlMarkerMode(nextHtmlMarkerMode);
      setMapboxMarkerVisualVisibility(map, !nextHtmlMarkerMode);
    }

    updateHtmlMarkerMode();
    map.on('zoomend', updateHtmlMarkerMode);

    return () => {
      map.off('zoomend', updateHtmlMarkerMode);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    setMapboxMarkerVisualVisibility(map, !htmlMarkerMode);

    if (!htmlMarkerMode) {
      htmlMarkersRef.current.forEach((entry) => entry.marker.remove());
      htmlMarkersRef.current.clear();
      return;
    }

    const nextMarkerKeys = new Set();

    for (const [groupKey, group] of diaryGroupMeta.entries()) {
      const center = group.center || getDiaryCoordinates(group[0]);
      if (!Array.isArray(center) || center.length < 2 || !center.every(Number.isFinite)) continue;

      const isExpanded = groupKey === expandedGroupKey && group.length > 1;
      const isSelectedStack = group.some((diary) => diary._id === selectedDiary?._id);

      if (group.length > 1) {
        const key = `stack-${groupKey}`;
        nextMarkerKeys.add(key);

        let entry = htmlMarkersRef.current.get(key);

        if (!entry) {
          const stackElement = createMemoryStackElement({
            count: group.length,
            expanded: isExpanded,
            theme,
            sampleDiary: group[0],
            groupKey,
            selected: isSelectedStack
          });

          stackElement.addEventListener('click', (event) => {
            event.stopPropagation();
            setExpandedGroupKey((current) => (current === groupKey ? null : groupKey));
          });
          stackElement.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            setExpandedGroupKey((current) => (current === groupKey ? null : groupKey));
          });
          stackElement.addEventListener('mouseenter', () => {
            const count = Number(stackElement.dataset.count || group.length);
            showMarkerTooltip(map, tooltipRef, center, `<strong>這裡有 ${count} 篇日記</strong><span>點擊展開選擇</span>`);
          });
          stackElement.addEventListener('focus', () => {
            const count = Number(stackElement.dataset.count || group.length);
            showMarkerTooltip(map, tooltipRef, center, `<strong>這裡有 ${count} 篇日記</strong><span>按 Enter 展開選擇</span>`);
          });
          stackElement.addEventListener('mouseleave', () => {
            tooltipRef.current?.remove();
            tooltipRef.current = null;
          });
          stackElement.addEventListener('blur', () => {
            tooltipRef.current?.remove();
            tooltipRef.current = null;
          });

          entry = {
            marker: new mapboxgl.Marker({
              element: stackElement,
              anchor: 'center',
              pitchAlignment: 'viewport',
              rotationAlignment: 'viewport'
            }).setLngLat(center).addTo(map)
          };
          htmlMarkersRef.current.set(key, entry);
        }

        updateMemoryStackElement(entry.marker.getElement(), {
          count: group.length,
          expanded: isExpanded,
          theme,
          map,
          center,
          group,
          sampleDiary: group[0],
          groupKey,
          selected: isSelectedStack,
          selectedId: selectedDiary?._id,
          onSelect,
          setHoveredDiaryId,
          tooltipRef
        });
        if (entry.lngLatKey !== groupKey) {
          entry.marker.setLngLat(center);
          entry.lngLatKey = groupKey;
        }
      }

      if (group.length === 1) {
        const diary = group[0];
        const key = `diary-${diary._id}`;
        nextMarkerKeys.add(key);

        let entry = htmlMarkersRef.current.get(key);
        if (!entry) {
          entry = {
            marker: createHtmlDiaryMarker({ map, diary, lngLat: center, theme, selectedId: selectedDiary?._id, onSelect, setHoveredDiaryId, tooltipRef })
          };
          htmlMarkersRef.current.set(key, entry);
        }

        updateHtmlDiaryMarkerElement(entry.marker.getElement(), {
          diary,
          compact: false,
          theme,
          selectedId: selectedDiary?._id,
          visualOffset: [0, 0]
        });
        if (entry.lngLatKey !== groupKey) {
          entry.marker.setLngLat(center);
          entry.lngLatKey = groupKey;
        }
        continue;
      }

    }

    htmlMarkersRef.current.forEach((entry, key) => {
      if (nextMarkerKeys.has(key)) return;
      entry.marker.remove();
      htmlMarkersRef.current.delete(key);
    });

    return () => {
      tooltipRef.current?.remove();
      tooltipRef.current = null;
    };
  }, [diaryGroupMeta, expandedGroupKey, htmlMarkerMode, mapReady, onSelect, selectedDiary?._id, theme]);

  useEffect(() => {
    const selectedId = selectedDiary?._id || '';

    htmlMarkersRef.current.forEach((entry) => {
      const element = entry.marker.getElement?.();
      if (!element) return;

      const isSelectedDiary = element.dataset.diaryId === selectedId;
      const selectedGroupKey = selectedDiary ? findDiaryGroupKey(selectedDiary, diaryGroupMeta) : '';
      const isSelectedStack = Boolean(selectedId && element.dataset.groupKey && element.dataset.groupKey === selectedGroupKey);

      element.classList.toggle('is-selected', isSelectedDiary || isSelectedStack);
      element.querySelector('.memory-marker')?.classList.toggle('is-selected', isSelectedDiary);
      element.querySelector('.memory-stack-marker')?.classList.toggle('is-selected', isSelectedStack);
    });
  }, [diaryGroupMeta, selectedDiary]);

  useEffect(() => {
    if (!selectedDiary?._id) return;

    const groupKey = findDiaryGroupKey(selectedDiary, diaryGroupMeta);
    const group = groupKey ? diaryGroupMeta.get(groupKey) : null;

    if (group?.length > 1) {
      setExpandedGroupKey(groupKey);
    }
  }, [diaryGroupMeta, selectedDiary?._id]);

  useEffect(() => {
    if (!expandedGroupKey || diaryGroupMeta.has(expandedGroupKey)) return;
    setExpandedGroupKey(null);
  }, [diaryGroupMeta, expandedGroupKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer('diary-clusters')) return;

    const isBright = theme === 'bright';
    const clusterGlowColor = isBright
      ? ['step', ['get', 'point_count'], 'rgba(0, 143, 199, 0.26)', 10, 'rgba(0, 180, 216, 0.28)', 40, 'rgba(124, 58, 237, 0.24)']
      : mode === 'explore'
        ? ['step', ['get', 'point_count'], 'rgba(154, 180, 255, 0.62)', 10, 'rgba(128, 179, 255, 0.66)', 40, 'rgba(178, 120, 255, 0.68)']
        : ['step', ['get', 'point_count'], 'rgba(121, 241, 220, 0.58)', 10, 'rgba(79, 195, 255, 0.62)', 40, 'rgba(178, 120, 255, 0.64)'];
    const clusterBodyColor = isBright
      ? ['step', ['get', 'point_count'], '#ffffff', 10, '#f3fbff', 40, '#f7f3ff']
      : ['step', ['get', 'point_count'], '#34d399', 10, '#38bdf8', 40, '#a78bfa'];
    const clusterStrokeColor = isBright
      ? ['step', ['get', 'point_count'], '#008fc7', 10, '#00a6d6', 40, '#7c3aed']
      : mode === 'explore'
        ? 'rgba(209, 205, 255, 0.72)'
        : 'rgba(210, 250, 255, 0.72)';

    map.setPaintProperty('diary-cluster-glow', 'circle-color', clusterGlowColor);
    map.setPaintProperty('diary-clusters', 'circle-color', clusterBodyColor);
    map.setPaintProperty('diary-clusters', 'circle-stroke-color', clusterStrokeColor);
    map.setPaintProperty('diary-clusters', 'circle-stroke-width', isBright ? 2.4 : 1.4);
    map.setPaintProperty('diary-cluster-count', 'text-color', isBright ? '#053d56' : '#eefcff');
    map.setPaintProperty('diary-cluster-count', 'text-halo-color', isBright ? 'rgba(255, 255, 255, 0.96)' : 'rgba(4, 12, 24, 0.72)');
  }, [mapReady, mode, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    function openCluster(event) {
      event?.originalEvent?.stopPropagation?.();
      const features = map.queryRenderedFeatures(event.point, { layers: ['diary-clusters'] });
      const cluster = features[0];
      const source = map.getSource('diaries');

      if (!cluster?.properties?.cluster_id || !source?.getClusterExpansionZoom) return;

      source.getClusterExpansionZoom(cluster.properties.cluster_id, (error, zoom) => {
        if (error) return;
        map.easeTo({
          center: cluster.geometry.coordinates,
          zoom,
          duration: 650
        });
      });
    }

    function openDiary(event) {
      event?.originalEvent?.stopPropagation?.();
      const feature = event.features?.[0];
      const overlapCount = Number(feature?.properties?.overlapCount || 1);
      const groupKey = feature?.properties?.groupKey || '';

      if (overlapCount > 1 && groupKey) {
        setExpandedGroupKey((current) => (current === groupKey ? null : groupKey));
        return;
      }

      const diary = diariesById.get(feature?.properties?.id);
      if (diary) onSelect(diary);
    }

    function showDiaryHover(event) {
      updateCursor();

      const feature = event.features?.[0];
      setHoveredDiaryId(feature?.properties?.id || null);

      const overlapCount = Number(feature?.properties?.overlapCount || 1);
      const diary = diariesById.get(feature?.properties?.id);

      tooltipRef.current?.remove();
      const tooltipHtml = overlapCount > 1
        ? `<strong>這裡有 ${overlapCount} 篇日記</strong><span>點擊展開選擇</span>`
        : diary
          ? getMarkerTooltipHtml(diary)
          : `<strong>${escapeHtml(feature?.properties?.title || '日記')}</strong><span>心情 · 時間</span>`;

      tooltipRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'memory-marker-tooltip',
        offset: 18,
        maxWidth: '220px'
      })
        .setLngLat(feature.geometry.coordinates)
        .setHTML(tooltipHtml)
        .addTo(map);
    }

    function hideDiaryHover() {
      setHoveredDiaryId(null);
      resetCursor();
      tooltipRef.current?.remove();
      tooltipRef.current = null;
    }

    function updateCursor() {
      map.getCanvas().style.cursor = 'pointer';
    }

    function resetCursor() {
      map.getCanvas().style.cursor = '';
    }

    function closeExpandedStack() {
      setExpandedGroupKey(null);
    }

    map.on('click', 'diary-cluster-glow', openCluster);
    map.on('click', 'diary-clusters', openCluster);
    map.on('click', 'diary-cluster-count', openCluster);
    map.on('click', 'diary-marker-hitbox', openDiary);
    map.on('click', 'diary-marker-shell', openDiary);
    map.on('click', 'diary-marker-core', openDiary);
    map.on('click', 'diary-marker-glyph', openDiary);
    map.on('click', 'diary-stack-count', openDiary);
    map.on('click', 'diary-selected-ring', openDiary);
    map.on('click', closeExpandedStack);
    map.on('mouseenter', 'diary-cluster-glow', updateCursor);
    map.on('mouseenter', 'diary-clusters', updateCursor);
    map.on('mouseenter', 'diary-cluster-count', updateCursor);
    map.on('mouseenter', 'diary-marker-hitbox', showDiaryHover);
    map.on('mouseenter', 'diary-marker-shell', showDiaryHover);
    map.on('mouseenter', 'diary-marker-core', showDiaryHover);
    map.on('mouseenter', 'diary-marker-glyph', showDiaryHover);
    map.on('mouseenter', 'diary-stack-count', showDiaryHover);
    map.on('mouseleave', 'diary-cluster-glow', resetCursor);
    map.on('mouseleave', 'diary-clusters', resetCursor);
    map.on('mouseleave', 'diary-cluster-count', resetCursor);
    map.on('mouseleave', 'diary-marker-hitbox', hideDiaryHover);
    map.on('mouseleave', 'diary-marker-shell', hideDiaryHover);
    map.on('mouseleave', 'diary-marker-core', hideDiaryHover);
    map.on('mouseleave', 'diary-marker-glyph', hideDiaryHover);
    map.on('mouseleave', 'diary-stack-count', hideDiaryHover);

    return () => {
      map.off('click', 'diary-cluster-glow', openCluster);
      map.off('click', 'diary-clusters', openCluster);
      map.off('click', 'diary-cluster-count', openCluster);
      map.off('click', 'diary-marker-hitbox', openDiary);
      map.off('click', 'diary-marker-shell', openDiary);
      map.off('click', 'diary-marker-core', openDiary);
      map.off('click', 'diary-marker-glyph', openDiary);
      map.off('click', 'diary-stack-count', openDiary);
      map.off('click', 'diary-selected-ring', openDiary);
      map.off('click', closeExpandedStack);
      map.off('mouseenter', 'diary-cluster-glow', updateCursor);
      map.off('mouseenter', 'diary-clusters', updateCursor);
      map.off('mouseenter', 'diary-cluster-count', updateCursor);
      map.off('mouseenter', 'diary-marker-hitbox', showDiaryHover);
      map.off('mouseenter', 'diary-marker-shell', showDiaryHover);
      map.off('mouseenter', 'diary-marker-core', showDiaryHover);
      map.off('mouseenter', 'diary-marker-glyph', showDiaryHover);
      map.off('mouseenter', 'diary-stack-count', showDiaryHover);
      map.off('mouseleave', 'diary-cluster-glow', resetCursor);
      map.off('mouseleave', 'diary-clusters', resetCursor);
      map.off('mouseleave', 'diary-cluster-count', resetCursor);
      map.off('mouseleave', 'diary-marker-hitbox', hideDiaryHover);
      map.off('mouseleave', 'diary-marker-shell', hideDiaryHover);
      map.off('mouseleave', 'diary-marker-core', hideDiaryHover);
      map.off('mouseleave', 'diary-marker-glyph', hideDiaryHover);
      map.off('mouseleave', 'diary-stack-count', hideDiaryHover);
      tooltipRef.current?.remove();
      tooltipRef.current = null;
    };
  }, [diariesById, expandedGroupKey, mapReady, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !onViewportChange || disabled) return;

    function requestVisibleDiaries() {
      window.clearTimeout(moveTimerRef.current);
      moveTimerRef.current = window.setTimeout(() => {
        const center = map.getCenter();
        const bounds = map.getBounds();
        const radius = Math.round(
          Math.max(
            distanceMeters(center.lat, center.lng, bounds.getNorth(), center.lng),
            distanceMeters(center.lat, center.lng, center.lat, bounds.getEast())
          ) * 1.25
        );

        onViewportChange({
          lat: center.lat,
          lng: center.lng,
          radius
        });
      }, 600);
    }

    map.on('moveend', requestVisibleDiaries);
    return () => {
      window.clearTimeout(moveTimerRef.current);
      map.off('moveend', requestVisibleDiaries);
    };
  }, [disabled, mapReady, onViewportChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    function handleMoveStart() {
      setIsMapMoving(true);
    }

    function handleMoveEnd() {
      setIsMapMoving(false);
      if (map.getZoom() < 13) {
        setExpandedGroupKey(null);
      }
    }

    map.on('movestart', handleMoveStart);
    map.on('zoomstart', handleMoveStart);
    map.on('rotatestart', handleMoveStart);
    map.on('pitchstart', handleMoveStart);
    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);
    map.on('rotateend', handleMoveEnd);
    map.on('pitchend', handleMoveEnd);

    return () => {
      map.off('movestart', handleMoveStart);
      map.off('zoomstart', handleMoveStart);
      map.off('rotatestart', handleMoveStart);
      map.off('pitchstart', handleMoveStart);
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      map.off('rotateend', handleMoveEnd);
      map.off('pitchend', handleMoveEnd);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    function updateMapViewState() {
      const nextPitch = map.getPitch();
      const nextBearing = map.getBearing();

      setMapPitch((current) => (Math.abs(current - nextPitch) > 0.25 ? nextPitch : current));
      setMapBearing((current) => (Math.abs(current - nextBearing) > 0.25 ? nextBearing : current));
    }

    updateMapViewState();
    map.on('pitch', updateMapViewState);
    map.on('rotate', updateMapViewState);
    map.on('move', updateMapViewState);

    return () => {
      map.off('pitch', updateMapViewState);
      map.off('rotate', updateMapViewState);
      map.off('move', updateMapViewState);
    };
  }, [mapReady]);

  useEffect(() => {
    const lat = Number(focusLocation?.lat);
    const lng = Number(focusLocation?.lng);

    if (!mapRef.current || !mapReady || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: getLocationZoom(focusLocation),
      speed: 1.2,
      curve: 1.4,
      essential: true
    });
  }, [focusLocation, mapReady]);

  useEffect(() => {
    if (!mapRef.current) return;

    const frameId = window.requestAnimationFrame(() => {
      mapRef.current?.resize();
    });

    const timeoutId = window.setTimeout(() => {
      mapRef.current?.resize();
    }, 350);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [expanded]);

  const show2DButton = MAPBOX_TOKEN && mapReady && mapPitch > 5;
  const showCompassButton = MAPBOX_TOKEN && mapReady && !isNorthUp(mapBearing);

  return (
    <motion.section
      className={`map-shell ${isMapMoving ? 'is-map-moving' : ''} ${lowPerformance ? 'low-performance-map' : ''} ${reducedMotion ? 'reduced-motion-map' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={pageTransition}
    >
      {MAPBOX_TOKEN ? (
        <div className="mapbox-container" ref={mapContainer} />
      ) : (
        <FallbackMap diaries={diaries} selectedId={selectedDiary?._id} currentLocation={currentLocation} onSelect={onSelect} />
      )}

      <div className="map-controls" aria-label="地圖控制">
        <button
          type="button"
          className="locate"
          onClick={onLocateUser}
          disabled={locating}
          aria-label="定位目前位置"
        >
          {locating ? <span className="button-spinner" /> : <Navigation size={18} />}
        </button>

        <div className="map-control-group glass">
          <AnimatePresence initial={false}>
            {showCompassButton && (
              <motion.button
                key="compass"
                type="button"
                className="compass"
                onClick={resetBearing}
                aria-label="回到北方在上"
                initial={{ opacity: 0, scale: 0.96, y: -3 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -3 }}
                transition={pageTransition}
              >
                <Compass size={17} style={{ transform: `rotate(${-mapBearing}deg)` }} />
              </motion.button>
            )}

            {show2DButton && (
              <motion.button
                key="2d"
                type="button"
                className="map-control-text"
                onClick={resetPitch}
                aria-label="返回 2D 地圖"
                initial={{ opacity: 0, scale: 0.96, y: -3 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -3 }}
                transition={pageTransition}
              >
                2D
              </motion.button>
            )}
          </AnimatePresence>

          <button type="button" onClick={() => zoomMap(1)} disabled={!MAPBOX_TOKEN || !mapReady} aria-label="放大地圖">
            <Plus size={17} />
          </button>
          <button type="button" onClick={() => zoomMap(-1)} disabled={!MAPBOX_TOKEN || !mapReady} aria-label="縮小地圖">
            <Minus size={17} />
          </button>
        </div>
      </div>

      <div className="map-memory-legend glass" aria-hidden="true">
        <span>✦</span>
        <strong>Adrift memories</strong>
      </div>
      <AnimatePresence>
        {!loading && !disabled && diaries.length === 0 && (
          <motion.div
            className="map-empty subtle glass"
            {...fadeUpMotion}
          >
            這片地圖還沒有留下記憶
          </motion.div>
        )}

        {loading && (
          <motion.div
            className="map-loading"
            {...toastMotion}
          >
            <div className="map-skeleton" />
            <p>{mode === 'explore' ? '正在探索附近日記...' : '正在載入地圖日記...'}</p>
          </motion.div>
        )}

        {selectedDiary && (
          <motion.div
            className="selection-ripple"
            initial={{ opacity: 0.55, scale: 0 }}
            animate={{ opacity: 0, scale: 5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );

  function zoomMap(delta) {
    const map = mapRef.current;
    if (!map) return;

    if (delta > 0) {
      map.zoomIn({ duration: 260, essential: true });
    } else {
      map.zoomOut({ duration: 260, essential: true });
    }
  }

  function resetPitch() {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      pitch: 0,
      duration: 500,
      essential: true
    });
  }

  function resetBearing() {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      bearing: 0,
      duration: 500,
      essential: true
    });
  }
}

function getLocationZoom(location) {
  return location?.accuracyType === 'approximate' || location?.source === 'ip' ? 11 : 15;
}

function isNorthUp(bearing) {
  const normalizedBearing = ((bearing % 360) + 360) % 360;
  return normalizedBearing < 3 || normalizedBearing > 357;
}

function buildDiaryFeatures(diaries, selectedId, hoveredId, theme = 'dark') {
  const validDiaries = diaries.filter((diary) => {
    const coordinates = getDiaryCoordinates(diary);
    return Array.isArray(coordinates) && coordinates.length >= 2 && coordinates.every(Number.isFinite);
  });

  const coordinateGroups = buildDiaryGroupMeta(validDiaries);
  const diaryGroupKeyById = buildDiaryGroupLookup(coordinateGroups);

  return validDiaries.map((diary) => {
    const coordinates = getDiaryCoordinates(diary);
    const key = diaryGroupKeyById.get(diary._id) || getDiaryGroupKey(diary);
    const group = coordinateGroups.get(key) || [diary];
    const groupIndex = group.findIndex((item) => item._id === diary._id);
    const locationAccuracy = normalizeLocationAccuracy(diary.locationAccuracy);
    const moodType = diary.mood?.type || 'other';
    const markerStyle = getMoodMarkerStyle(moodType, { explore: Boolean(diary.isExplore) });
    const palette = getDiaryMarkerPalette(markerStyle, theme, Boolean(diary.isExplore));

    return {
      type: 'Feature',
      properties: {
        id: diary._id,
        title: getDiaryTitle(diary),
        groupKey: key,
        mood: moodType,
        moodIcon: palette.markerGlyph,
        markerGlyph: palette.markerGlyph,
        markerColor: palette.markerColor,
        markerRgb: markerStyle.rgb,
        markerGlowColor: palette.markerHaloColor,
        markerHaloColor: palette.markerHaloColor,
        markerShellColor: palette.markerShellColor,
        markerStrokeColor: palette.markerStrokeColor,
        markerFocusColor: palette.markerFocusColor,
        markerGlyphColor: palette.markerGlyphColor,
        markerGlyphHaloColor: palette.markerGlyphHaloColor,
        stackCountTextColor: palette.stackCountTextColor,
        stackCountHaloColor: palette.stackCountHaloColor,
        markerGlassColor: palette.markerShellColor,
        markerCoreColor: markerStyle.core,
        explore: Boolean(diary.isExplore),
        selected: diary._id === selectedId,
        hovered: diary._id === hoveredId,
        expanded: false,
        approximate: locationAccuracy === 'approximate',
        overlapIndex: groupIndex,
        overlapCount: group.length,
        stackRoot: groupIndex === 0
      },
      geometry: {
        type: 'Point',
        coordinates
      }
    };
  });
}

function buildDiaryGroupMeta(diaries) {
  const sortedDiaries = sortDiariesForStack(diaries);
  const groupedItems = [];

  sortedDiaries.forEach((diary) => {
    const coordinates = getDiaryLngLat(diary);
    if (!coordinates) return;

    const existingGroup = groupedItems.find((group) => {
      return getDistanceMeters(group.center, coordinates) <= OVERLAP_GROUP_DISTANCE_METERS;
    });

    if (existingGroup) {
      existingGroup.diaries.push(diary);
      return;
    }

    groupedItems.push({
      groupKey: getCoordinateGroupKey(coordinates),
      center: coordinates,
      diaries: [diary]
    });
  });

  const groups = new Map();

  groupedItems.forEach((item) => {
    const group = sortDiariesForStack(item.diaries);
    group.groupKey = item.groupKey;
    group.center = [item.center.lng, item.center.lat];
    groups.set(item.groupKey, group);
  });

  groups.forEach((group, key) => {
    groups.set(key, sortDiariesForStack(group));
    groups.get(key).groupKey = group.groupKey;
    groups.get(key).center = group.center;
  });

  return groups;
}

function buildDiaryGroupLookup(groups) {
  const lookup = new Map();

  groups.forEach((group, groupKey) => {
    group.forEach((diary) => {
      if (diary?._id) lookup.set(diary._id, groupKey);
    });
  });

  return lookup;
}

function getDiaryGroupKey(diary) {
  const coordinates = getDiaryLngLat(diary);
  return coordinates ? getCoordinateGroupKey(coordinates) : '';
}

function getCoordinateGroupKey({ lng, lat }) {
  return `${lng.toFixed(5)}:${lat.toFixed(5)}`;
}

function getDiaryCoordinates(diary) {
  const coordinates = diary?.location?.coordinates || diary?.geo?.coordinates || diary?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }

  const lng = Number(diary?.location?.lng ?? diary?.location?.longitude ?? diary?.lng ?? diary?.longitude);
  const lat = Number(diary?.location?.lat ?? diary?.location?.latitude ?? diary?.lat ?? diary?.latitude);
  if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  return null;
}

function getDiaryLngLat(diary) {
  const coordinates = getDiaryCoordinates(diary);
  if (!coordinates) return null;

  const [lng, lat] = coordinates;
  return { lng, lat };
}

function findDiaryGroupKey(diary, groups) {
  if (!diary?._id || !groups?.size) return getDiaryGroupKey(diary);

  for (const [groupKey, group] of groups.entries()) {
    if (group.some((item) => item?._id === diary._id)) return groupKey;
  }

  return getDiaryGroupKey(diary);
}

function getDistanceMeters(a, b) {
  return distanceMeters(a.lat, a.lng, b.lat, b.lng);
}

function sortDiariesForStack(diaries = []) {
  return [...diaries].sort((left, right) => {
    const rightTime = new Date(right?.createdAt || 0).getTime();
    const leftTime = new Date(left?.createdAt || 0).getTime();

    if (rightTime !== leftTime) return rightTime - leftTime;
    return (right?._id || '').localeCompare(left?._id || '');
  });
}

function getSpiderfyRadius(count) {
  if (count <= 2) return 42;
  if (count <= 5) return 50;
  if (count <= 9) return 60;
  return 72;
}

function getExpandedPosition(index, count) {
  const radius = Math.min(58 + count * 5, 96);
  const startAngle = count <= 4 ? -Math.PI / 2 : -Math.PI / 2 - Math.PI / count;
  const angle = count === 1 ? 0 : startAngle + (Math.PI * 2 * index) / count;

  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius)
  };
}

function getDiaryTitle(diary) {
  return diary?.title || diary?.text?.slice?.(0, 18) || diary?.content?.slice?.(0, 18) || '未命名日記';
}

function setMapboxMarkerVisualVisibility(map, visible) {
  const visibility = visible ? 'visible' : 'none';
  const visualLayerIds = [
    'diary-marker-glow',
    'diary-marker-hitbox',
    'diary-marker-shell',
    'diary-marker-core',
    'diary-marker-glyph',
    'diary-stack-count',
    'diary-selected-ring'
  ];

  visualLayerIds.forEach((layerId) => {
    if (!map.getLayer(layerId)) return;

    try {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    } catch {
      // Mapbox style layers can briefly disappear while the base style is changing.
    }
  });
}

function createMemoryStackElement({ count, expanded, theme, sampleDiary, groupKey, selected }) {
  const moodType = sampleDiary?.mood?.type || 'calm';
  const markerStyle = getMoodMarkerStyle(moodType, { explore: Boolean(sampleDiary?.isExplore) });
  const palette = getDiaryMarkerPalette(markerStyle, theme, Boolean(sampleDiary?.isExplore));
  const element = document.createElement('div');

  element.className = `marker-mapbox-anchor marker-stack-anchor ${selected ? 'is-selected' : ''}`.trim();
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-label', expanded ? `收合 ${count} 篇日記` : `展開 ${count} 篇日記`);
  element.dataset.groupKey = groupKey || '';
  element.dataset.count = count.toString();
  applyMarkerCssVars(element, palette, markerStyle);
  element.innerHTML = `
    <div class="marker-hit-area">
      <div class="marker-visual memory-stack-marker ${expanded ? 'is-expanded' : ''} ${selected ? 'is-selected' : ''}">
        <span class="memory-stack-aura" aria-hidden="true"></span>
        <button class="memory-stack-core" type="button" tabindex="-1">
          <span class="memory-stack-rings" aria-hidden="true"></span>
          <span class="memory-stack-count">${escapeHtml(count)}</span>
          <span class="memory-stack-shine" aria-hidden="true"></span>
        </button>
        <div class="memory-stack-expanded" aria-hidden="true"></div>
      </div>
    </div>
  `;

  return element;
}

function updateMemoryStackElement(element, {
  count,
  expanded,
  theme,
  map,
  center,
  group,
  sampleDiary,
  groupKey,
  selected,
  selectedId,
  onSelect,
  setHoveredDiaryId,
  tooltipRef
}) {
  const moodType = sampleDiary?.mood?.type || 'calm';
  const markerStyle = getMoodMarkerStyle(moodType, { explore: Boolean(sampleDiary?.isExplore) });
  const palette = getDiaryMarkerPalette(markerStyle, theme, Boolean(sampleDiary?.isExplore));
  const visual = element.querySelector('.memory-stack-marker');
  const countElement = element.querySelector('.memory-stack-count');
  const expandedLayer = element.querySelector('.memory-stack-expanded');

  element.dataset.groupKey = groupKey || '';
  element.dataset.count = count.toString();
  element.classList.toggle('is-selected', Boolean(selected));
  element.classList.toggle('is-expanded', Boolean(expanded));
  visual?.classList.toggle('is-expanded', Boolean(expanded));
  visual?.classList.toggle('is-selected', Boolean(selected));
  if (countElement) countElement.textContent = count.toString();
  element.setAttribute('aria-label', expanded ? `收合 ${count} 篇日記` : `展開 ${count} 篇日記`);
  applyMarkerCssVars(element, palette, markerStyle);

  if (!expandedLayer) return;

  expandedLayer.setAttribute('aria-hidden', expanded ? 'false' : 'true');
  expandedLayer.onclick = (event) => event.stopPropagation();
  expandedLayer.onkeydown = (event) => event.stopPropagation();

  if (!expanded) {
    expandedLayer.innerHTML = '';
    return;
  }

  const sortedGroup = sortDiariesForStack(group || []);
  const usePanel = sortedGroup.length > 8;

  if (usePanel) {
    expandedLayer.innerHTML = `
      <section class="memory-stack-panel" role="dialog" aria-label="選擇這裡的日記">
        <div class="memory-stack-panel-header">
          <strong>這裡有 ${escapeHtml(sortedGroup.length)} 篇日記</strong>
          <span>選擇一篇查看</span>
        </div>
        <div class="memory-stack-panel-list">
          ${sortedGroup.map((diary) => {
            const diaryMoodType = diary?.mood?.type || 'calm';
            const diaryMarkerStyle = getMoodMarkerStyle(diaryMoodType, { explore: Boolean(diary?.isExplore) });
            const diaryPalette = getDiaryMarkerPalette(diaryMarkerStyle, theme, Boolean(diary?.isExplore));
            return `
              <button class="memory-stack-panel-item ${diary?._id === selectedId ? 'is-selected' : ''}" type="button" data-diary-id="${escapeHtml(diary?._id || '')}" style="--marker-rgb: ${escapeHtml(hexToRgbString(diaryPalette.markerColor) || diaryMarkerStyle.rgb || '45, 212, 191')}">
                <span class="memory-stack-panel-dot" aria-hidden="true"></span>
                <span>
                  <strong>${escapeHtml(getDiaryTitle(diary))}</strong>
                  <small>${escapeHtml(getMoodLabel(diaryMoodType))} · ${escapeHtml(formatMarkerTime(diary?.createdAt))}</small>
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </section>
    `;
  } else {
    expandedLayer.innerHTML = `
      <svg class="memory-stack-connector-layer" viewBox="-120 -120 240 240" aria-hidden="true">
        ${sortedGroup.map((diary, index) => {
          const { x, y } = getExpandedPosition(index, sortedGroup.length);
          return `<line x1="0" y1="0" x2="${x}" y2="${y}" />`;
        }).join('')}
      </svg>
      ${sortedGroup.map((diary, index) => {
        const { x, y } = getExpandedPosition(index, sortedGroup.length);
        const diaryMoodType = diary?.mood?.type || 'calm';
        const diaryMarkerStyle = getMoodMarkerStyle(diaryMoodType, { explore: Boolean(diary?.isExplore) });
        const diaryPalette = getDiaryMarkerPalette(diaryMarkerStyle, theme, Boolean(diary?.isExplore));
        const rgb = hexToRgbString(diaryPalette.markerColor) || diaryMarkerStyle.rgb || '45, 212, 191';

        return `
          <button
            class="memory-stack-expanded-item ${diary?._id === selectedId ? 'is-selected' : ''}"
            type="button"
            data-diary-id="${escapeHtml(diary?._id || '')}"
            style="--expanded-x: ${x}px; --expanded-y: ${y}px; --marker-rgb: ${escapeHtml(rgb)}; --marker-color: ${escapeHtml(diaryPalette.markerColor)}"
            aria-label="查看日記：${escapeHtml(getDiaryTitle(diary))}"
          >
            <span class="memory-expanded-aura" aria-hidden="true"></span>
            <span class="memory-expanded-core" aria-hidden="true">
              <span class="memory-expanded-dot"></span>
              <span class="memory-expanded-shine"></span>
            </span>
          </button>
        `;
      }).join('')}
    `;
  }

  expandedLayer.querySelectorAll('[data-diary-id]').forEach((button) => {
    const diary = sortedGroup.find((item) => item?._id === button.getAttribute('data-diary-id'));
    if (!diary) return;

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelect?.(diary);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      onSelect?.(diary);
    });
    button.addEventListener('mouseenter', () => {
      setHoveredDiaryId?.(diary?._id || null);
      showMarkerTooltip(map, tooltipRef, center, getMarkerTooltipHtml(diary));
    });
    button.addEventListener('focus', () => {
      setHoveredDiaryId?.(diary?._id || null);
      showMarkerTooltip(map, tooltipRef, center, getMarkerTooltipHtml(diary));
    });
    button.addEventListener('mouseleave', () => {
      setHoveredDiaryId?.(null);
      tooltipRef.current?.remove();
      tooltipRef.current = null;
    });
    button.addEventListener('blur', () => {
      setHoveredDiaryId?.(null);
      tooltipRef.current?.remove();
      tooltipRef.current = null;
    });
  });
}

function createHtmlDiaryMarker({
  map,
  diary,
  lngLat,
  visualOffset = [0, 0],
  compact = false,
  theme,
  selectedId,
  onSelect,
  setHoveredDiaryId,
  tooltipRef
}) {
  const moodType = diary?.mood?.type || 'calm';
  const markerStyle = getMoodMarkerStyle(moodType, { explore: Boolean(diary?.isExplore) });
  const palette = getDiaryMarkerPalette(markerStyle, theme, Boolean(diary?.isExplore));
  const approximate = normalizeLocationAccuracy(diary?.locationAccuracy) === 'approximate';
  const selected = diary?._id === selectedId;
  const element = document.createElement('div');
  const [offsetX, offsetY] = visualOffset.map((value) => (Number.isFinite(value) ? value : 0));

  element.className = [
    'marker-mapbox-anchor',
    'marker-diary-anchor',
    compact ? 'is-compact is-expanded-child' : '',
    selected ? 'is-selected' : '',
    approximate ? 'is-approximate' : '',
    diary?.isExplore ? 'is-explore' : ''
  ]
    .filter(Boolean)
    .join(' ');
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-label', `查看日記：${getDiaryTitle(diary)}`);
  element.dataset.diaryId = diary?._id || '';
  element.dataset.groupKey = getDiaryGroupKey(diary);
  applyMarkerCssVars(element, palette, markerStyle);
  element.style.setProperty('--marker-offset-x', `${offsetX}px`);
  element.style.setProperty('--marker-offset-y', `${offsetY}px`);
  element.innerHTML = `
    <div class="marker-hit-area">
      <div class="marker-visual memory-marker ${compact ? 'is-compact is-expanded-child' : ''} ${selected ? 'is-selected' : ''}">
        <span class="memory-marker-aura" aria-hidden="true"></span>
        <span class="memory-marker-orbit" aria-hidden="true"></span>
        <button class="memory-marker-core" type="button" tabindex="-1">
          <span class="memory-marker-glass" aria-hidden="true"></span>
          <span class="memory-marker-dot" aria-hidden="true"></span>
          <span class="memory-marker-shine" aria-hidden="true"></span>
        </button>
      </div>
    </div>
  `;

  function selectDiary(event) {
    event?.stopPropagation?.();
    if (diary) onSelect?.(diary);
  }

  function showTooltip() {
    element.classList.add('is-hovered');
    setHoveredDiaryId?.(diary?._id || null);
    showMarkerTooltip(map, tooltipRef, lngLat, getMarkerTooltipHtml(diary));
  }

  function hideTooltip() {
    element.classList.remove('is-hovered');
    setHoveredDiaryId?.(null);
    tooltipRef.current?.remove();
    tooltipRef.current = null;
  }

  element.addEventListener('click', selectDiary);
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectDiary(event);
  });
  element.addEventListener('mouseenter', showTooltip);
  element.addEventListener('focus', showTooltip);
  element.addEventListener('mouseleave', hideTooltip);
  element.addEventListener('blur', hideTooltip);

  return new mapboxgl.Marker({
    element,
    anchor: 'center',
    pitchAlignment: 'viewport',
    rotationAlignment: 'viewport'
  }).setLngLat(lngLat).addTo(map);
}

function updateHtmlDiaryMarkerElement(element, { diary, compact, theme, selectedId, visualOffset }) {
  const moodType = diary?.mood?.type || 'calm';
  const markerStyle = getMoodMarkerStyle(moodType, { explore: Boolean(diary?.isExplore) });
  const palette = getDiaryMarkerPalette(markerStyle, theme, Boolean(diary?.isExplore));
  const approximate = normalizeLocationAccuracy(diary?.locationAccuracy) === 'approximate';
  const selected = diary?._id === selectedId;
  const [offsetX, offsetY] = visualOffset.map((value) => (Number.isFinite(value) ? value : 0));
  const visual = element.querySelector('.memory-marker');

  element.dataset.diaryId = diary?._id || '';
  element.dataset.groupKey = getDiaryGroupKey(diary);
  element.classList.toggle('is-compact', Boolean(compact));
  element.classList.toggle('is-expanded-child', Boolean(compact));
  element.classList.toggle('is-selected', Boolean(selected));
  element.classList.toggle('is-approximate', approximate);
  element.classList.toggle('is-explore', Boolean(diary?.isExplore));
  element.style.setProperty('--marker-offset-x', `${offsetX}px`);
  element.style.setProperty('--marker-offset-y', `${offsetY}px`);
  element.setAttribute('aria-label', `查看日記：${getDiaryTitle(diary)}`);

  if (visual) {
    visual.classList.toggle('is-compact', Boolean(compact));
    visual.classList.toggle('is-expanded-child', Boolean(compact));
    visual.classList.toggle('is-selected', Boolean(selected));
  }

  applyMarkerCssVars(element, palette, markerStyle);
}

function applyMarkerCssVars(element, palette, markerStyle) {
  const rgb = hexToRgbString(palette.markerColor) || markerStyle.rgb || '45, 212, 191';
  element.style.setProperty('--marker-rgb', rgb);
  element.style.setProperty('--marker-color', palette.markerColor);
}

function showMarkerTooltip(map, tooltipRef, lngLat, html) {
  tooltipRef.current?.remove();
  tooltipRef.current = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'memory-marker-tooltip',
    offset: 18,
    maxWidth: '220px'
  })
    .setLngLat(lngLat)
    .setHTML(html)
    .addTo(map);
}

function getMarkerTooltipHtml(diary) {
  const title = escapeHtml(getDiaryTitle(diary));
  const mood = getMoodLabel(diary?.mood?.type);
  const time = formatMarkerTime(diary?.createdAt);

  return `
    <strong>${title}</strong>
    <span>${escapeHtml(mood)} · ${escapeHtml(time)}</span>
  `;
}

function getMoodLabel(type) {
  const moodLabels = {
    happy: '開心',
    joy: '開心',
    calm: '平靜',
    sad: '難過',
    anxious: '焦慮',
    anxiety: '焦慮',
    confused: '疑惑',
    angry: '生氣',
    excited: '興奮',
    wonder: '驚喜',
    nostalgic: '懷舊',
    other: '心情'
  };

  return moodLabels[type] || '心情';
}

function formatMarkerTime(value) {
  if (!value) return '剛剛';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '剛剛';

  return date.toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function hexToRgbString(hexColor) {
  const normalized = hexColor?.replace?.('#', '') || '';
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '';

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ].join(', ');
}

function getDiaryMarkerPalette(markerStyle, theme, explore) {
  const isBright = theme === 'bright';
  const color = isBright ? getBrightMarkerColor(markerStyle.color, explore) : markerStyle.color;

  if (isBright) {
    return {
      markerColor: color,
      markerHaloColor: withAlpha(color, 0.24),
      markerShellColor: 'rgba(255, 255, 255, 0.96)',
      markerStrokeColor: withAlpha(color, 0.86),
      markerFocusColor: '#053d56',
      markerGlyph: '✦',
      markerGlyphColor: '#053d56',
      markerGlyphHaloColor: 'rgba(255, 255, 255, 0.96)',
      stackCountTextColor: '#053d56',
      stackCountHaloColor: 'rgba(255, 255, 255, 0.96)',
      connectorColor: withAlpha(color, 0.5)
    };
  }

  return {
    markerColor: color,
    markerHaloColor: markerStyle.glow,
    markerShellColor: explore ? 'rgba(16, 18, 42, 0.86)' : 'rgba(8, 18, 32, 0.84)',
    markerStrokeColor: markerStyle.color,
    markerFocusColor: 'rgba(245, 253, 255, 0.96)',
    markerGlyph: '✦',
    markerGlyphColor: markerStyle.core || '#eaffff',
    markerGlyphHaloColor: 'rgba(4, 12, 24, 0.82)',
    stackCountTextColor: '#f4feff',
    stackCountHaloColor: 'rgba(4, 12, 24, 0.92)',
    connectorColor: withAlpha(markerStyle.color, 0.58)
  };
}

function getBrightMarkerColor(color, explore) {
  if (explore) return '#7c3aed';

  const brightMap = {
    '#70e6d2': '#008f88',
    '#f4d278': '#b7791f',
    '#78aae6': '#2563eb',
    '#aa8cf0': '#6d5bd0',
    '#818cf8': '#4f46e5',
    '#f08278': '#dc2626',
    '#dcbcff': '#7c3aed',
    '#c9ad84': '#9a6b28',
    '#7dd3fc': '#0284c7'
  };

  return brightMap[color] || '#008fc7';
}

function withAlpha(hexColor, alpha) {
  const normalized = hexColor?.replace?.('#', '') || '';
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(0, 143, 199, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function escapeHtml(value = '') {
  return value
    .toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function tuneBaseMapStyle(map, theme) {
  if (theme !== 'bright') return;

  const layers = map.getStyle()?.layers || [];

  layers.forEach((layer) => {
    if (layer.type !== 'symbol') return;
    const id = layer.id || '';

    try {
      if (/poi|transit|airport|settlement-subdivision/i.test(id)) {
        map.setLayoutProperty(id, 'visibility', 'none');
        return;
      }

      if (/road-label|natural-label|place-label/i.test(id)) {
        map.setPaintProperty(id, 'text-opacity', 0.72);
        map.setPaintProperty(id, 'icon-opacity', 0.42);
      }
    } catch {
      // Some Mapbox style layers do not expose the same paint/layout properties.
    }
  });
}

function normalizeLocationAccuracy(value) {
  return value === 'approximate' ? 'approximate' : 'precise';
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const radius = 6371000;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
