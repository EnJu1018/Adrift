import mapboxgl from 'mapbox-gl';
import { AnimatePresence, motion } from 'framer-motion';
import { Compass, Minus, Navigation, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fadeUpMotion, pageTransition, toastMotion } from '../constants/animations.js';
import { getMoodMarkerStyle } from '../constants/moodStyles.js';
import FallbackMap from './FallbackMap.jsx';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
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
  reducedMotion = false
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const moveTimerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapPitch, setMapPitch] = useState(0);
  const [mapBearing, setMapBearing] = useState(0);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [hoveredDiaryId, setHoveredDiaryId] = useState(null);
  const diariesById = useMemo(() => {
    return new Map((diaries || []).map((diary) => [diary._id, diary]));
  }, [diaries]);

  const geoJson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: buildDiaryFeatures(diaries || [], selectedDiary?._id, hoveredDiaryId)
    };
  }, [diaries, hoveredDiaryId, selectedDiary?._id]);

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
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [121.5654, 25.033],
      zoom: 3.2,
      attributionControl: false
    });

    mapRef.current = map;

    map.on('load', () => {
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
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'approximate'], true]],
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
        id: 'diary-marker-glow',
        type: 'circle',
        source: 'diaries',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'circle-sort-key': ['case', ['boolean', ['get', 'selected'], false], 3, ['boolean', ['get', 'hovered'], false], 2, 1]
        },
        paint: {
          'circle-color': ['get', 'markerGlowColor'],
          'circle-radius': [
            'case',
            ['boolean', ['get', 'selected'], false],
            23,
            ['boolean', ['get', 'hovered'], false],
            20,
            ['boolean', ['get', 'approximate'], false],
            19,
            18
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
        filter: ['!', ['has', 'point_count']],
        layout: {
          'circle-sort-key': ['case', ['boolean', ['get', 'selected'], false], 3, ['boolean', ['get', 'hovered'], false], 2, 1]
        },
        paint: {
          'circle-color': [
            'case',
            ['boolean', ['get', 'selected'], false],
            'rgba(13, 28, 44, 0.88)',
            ['boolean', ['get', 'hovered'], false],
            'rgba(12, 28, 44, 0.82)',
            'rgba(8, 18, 32, 0.76)'
          ],
          'circle-radius': [
            'case',
            ['boolean', ['get', 'selected'], false],
            12.4,
            ['boolean', ['get', 'hovered'], false],
            11.8,
            ['boolean', ['get', 'approximate'], false],
            10.8,
            10.6
          ],
          'circle-stroke-color': [
            'case',
            ['boolean', ['get', 'selected'], false],
            'rgba(245, 253, 255, 0.96)',
            ['get', 'markerColor']
          ],
          'circle-stroke-width': [
            'case',
            ['boolean', ['get', 'selected'], false],
            2.1,
            ['boolean', ['get', 'hovered'], false],
            1.8,
            ['boolean', ['get', 'approximate'], false],
            1.15,
            1.45
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
        filter: ['!', ['has', 'point_count']],
        layout: {
          'circle-sort-key': ['case', ['boolean', ['get', 'selected'], false], 3, ['boolean', ['get', 'hovered'], false], 2, 1]
        },
        paint: {
          'circle-color': ['get', 'markerColor'],
          'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 4.8, 3.8],
          'circle-opacity': ['case', ['boolean', ['get', 'approximate'], false], 0.62, 0.88],
          'circle-blur': 0,
          'circle-emissive-strength': 1
        }
      });

      map.addLayer({
        id: 'diary-selected-ring',
        type: 'circle',
        source: 'diaries',
        filter: ['all', ['!', ['has', 'point_count']], ['any', ['==', ['get', 'selected'], true], ['==', ['get', 'hovered'], true]]],
        paint: {
          'circle-color': 'rgba(255, 255, 255, 0)',
          'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 15.2, 13.2],
          'circle-stroke-color': ['get', 'markerColor'],
          'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 1.6, 1],
          'circle-stroke-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.74, 0.42],
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
    if (!map || !mapReady || !map.getLayer('diary-clusters')) return;

    const clusterGlowColor =
      mode === 'explore'
        ? ['step', ['get', 'point_count'], 'rgba(154, 180, 255, 0.62)', 10, 'rgba(128, 179, 255, 0.66)', 40, 'rgba(178, 120, 255, 0.68)']
        : ['step', ['get', 'point_count'], 'rgba(121, 241, 220, 0.58)', 10, 'rgba(79, 195, 255, 0.62)', 40, 'rgba(178, 120, 255, 0.64)'];

    map.setPaintProperty('diary-cluster-glow', 'circle-color', clusterGlowColor);
    map.setPaintProperty('diary-clusters', 'circle-stroke-color', mode === 'explore' ? 'rgba(209, 205, 255, 0.72)' : 'rgba(210, 250, 255, 0.72)');
  }, [mapReady, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    function openCluster(event) {
      const features = map.queryRenderedFeatures(event.point, { layers: ['diary-clusters'] });
      const cluster = features[0];
      const source = map.getSource('diaries');

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
      const feature = event.features?.[0];
      const diary = diariesById.get(feature?.properties?.id);
      if (diary) onSelect(diary);
    }

    function showDiaryHover(event) {
      updateCursor();

      const feature = event.features?.[0];
      setHoveredDiaryId(feature?.properties?.id || null);

      if (!feature?.properties?.approximate) return;

      tooltipRef.current?.remove();
      tooltipRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'approximate-tooltip',
        offset: 12
      })
        .setLngLat(feature.geometry.coordinates)
        .setHTML('<span>此日記使用大略位置</span>')
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

    map.on('click', 'diary-cluster-glow', openCluster);
    map.on('click', 'diary-clusters', openCluster);
    map.on('click', 'diary-cluster-count', openCluster);
    map.on('click', 'diary-marker-shell', openDiary);
    map.on('click', 'diary-marker-core', openDiary);
    map.on('click', 'diary-selected-ring', openDiary);
    map.on('mouseenter', 'diary-cluster-glow', updateCursor);
    map.on('mouseenter', 'diary-clusters', updateCursor);
    map.on('mouseenter', 'diary-cluster-count', updateCursor);
    map.on('mouseenter', 'diary-marker-shell', showDiaryHover);
    map.on('mouseenter', 'diary-marker-core', showDiaryHover);
    map.on('mouseleave', 'diary-cluster-glow', resetCursor);
    map.on('mouseleave', 'diary-clusters', resetCursor);
    map.on('mouseleave', 'diary-cluster-count', resetCursor);
    map.on('mouseleave', 'diary-marker-shell', hideDiaryHover);

    return () => {
      map.off('click', 'diary-cluster-glow', openCluster);
      map.off('click', 'diary-clusters', openCluster);
      map.off('click', 'diary-cluster-count', openCluster);
      map.off('click', 'diary-marker-shell', openDiary);
      map.off('click', 'diary-marker-core', openDiary);
      map.off('click', 'diary-selected-ring', openDiary);
      map.off('mouseenter', 'diary-cluster-glow', updateCursor);
      map.off('mouseenter', 'diary-clusters', updateCursor);
      map.off('mouseenter', 'diary-cluster-count', updateCursor);
      map.off('mouseenter', 'diary-marker-shell', showDiaryHover);
      map.off('mouseenter', 'diary-marker-core', showDiaryHover);
      map.off('mouseleave', 'diary-cluster-glow', resetCursor);
      map.off('mouseleave', 'diary-clusters', resetCursor);
      map.off('mouseleave', 'diary-cluster-count', resetCursor);
      map.off('mouseleave', 'diary-marker-shell', hideDiaryHover);
      tooltipRef.current?.remove();
      tooltipRef.current = null;
    };
  }, [diariesById, mapReady, onSelect]);

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

function buildDiaryFeatures(diaries, selectedId, hoveredId) {
  const validDiaries = diaries.filter((diary) => {
    const coordinates = diary.location?.coordinates;
    return Array.isArray(coordinates) && coordinates.length >= 2 && coordinates.every(Number.isFinite);
  });

  const coordinateGroups = validDiaries.reduce((groups, diary) => {
    const [lng, lat] = diary.location.coordinates;
    const key = `${Number(lng).toFixed(5)},${Number(lat).toFixed(5)}`;
    const group = groups.get(key) || [];
    group.push(diary);
    groups.set(key, group);
    return groups;
  }, new Map());

  return validDiaries.map((diary) => {
    const coordinates = diary.location.coordinates;
    const key = `${Number(coordinates[0]).toFixed(5)},${Number(coordinates[1]).toFixed(5)}`;
    const group = coordinateGroups.get(key) || [diary];
    const groupIndex = group.findIndex((item) => item._id === diary._id);
    const locationAccuracy = normalizeLocationAccuracy(diary.locationAccuracy);
    const moodType = diary.mood?.type || 'other';
    const markerStyle = getMoodMarkerStyle(moodType, { explore: Boolean(diary.isExplore) });

    return {
      type: 'Feature',
      properties: {
        id: diary._id,
        mood: moodType,
        moodIcon: markerStyle.icon,
        markerColor: markerStyle.color,
        markerRgb: markerStyle.rgb,
        markerGlowColor: markerStyle.glow,
        markerGlassColor: markerStyle.glass,
        markerCoreColor: markerStyle.core,
        explore: Boolean(diary.isExplore),
        selected: diary._id === selectedId,
        hovered: diary._id === hoveredId,
        approximate: locationAccuracy === 'approximate',
        overlapIndex: groupIndex,
        overlapCount: group.length
      },
      geometry: {
        type: 'Point',
        coordinates
      }
    };
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


