import mapboxgl from 'mapbox-gl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Compass, Minus, Navigation, Plus } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dropdownMotion, motionMs, motionTokens } from '../constants/animations.js';
import FallbackMap from './FallbackMap.jsx';
import DiaryMarkerLayer from './markers/DiaryMarkerLayer.jsx';
import { groupDiaryMarkers } from './markers/markerGeometry.js';
import { getMapFocusOffset, getMapObstacles } from './markers/markerLayout.js';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const mapStyles = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  bright: 'mapbox://styles/mapbox/light-v11'
};

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
  const styleThemeRef = useRef(theme);
  const locationDataRef = useRef(null);
  const previousGroups = useRef([]);
  const geographicGroups = useMemo(() => groupDiaryMarkers(diaries, previousGroups.current), [diaries]);
  useLayoutEffect(() => { previousGroups.current = geographicGroups; }, [geographicGroups]);
  const [mapReady, setMapReady] = useState(false);
  const [mapPitch, setMapPitch] = useState(0);
  const [mapBearing, setMapBearing] = useState(0);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const systemReducedMotion = useReducedMotion();
  const quiet = reducedMotion || systemReducedMotion;
  const statusMotion = {
    initial: quiet ? false : { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 },
    transition: { duration: quiet ? 0 : motionTokens.duration.quick }
  };

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
  locationDataRef.current = currentLocationGeoJson;

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

    map.on('style.load', () => {
      tuneBaseMapStyle(map, styleThemeRef.current);
      if (map.getSource('current-location')) return;
      map.addSource('current-location', {
        type: 'geojson',
        data: locationDataRef.current
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
    if (!map || styleThemeRef.current === theme) return;
    styleThemeRef.current = theme;
    // A full style load restores custom location layers; DOM markers stay mounted.
    map.setStyle(mapStyles[theme] || mapStyles.dark, { diff: false });
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource('current-location');
    source?.setData(currentLocationGeoJson);
  }, [currentLocationGeoJson, mapReady]);


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

    if (focusLocation.source === 'marker') return;
    const map = mapRef.current;
    const frame = requestAnimationFrame(() => {
      // A responsive layout change can precede ResizeObserver's map update.
      map.resize();
      const group = previousGroups.current.find((item) => item.diaries.some((diary) => String(diary._id) === String(focusLocation.diaryId)));
      const center = group?.center || { lng, lat };
      const nearestLng = center.lng + Math.round((map.getCenter().lng - center.lng) / 360) * 360;
      const diaryFocus = Boolean(focusLocation.diaryId);
      map.stop();
      map.easeTo({
        center: [nearestLng, center.lat],
        offset: getMapFocusOffset(map.getContainer().getBoundingClientRect(), getMapObstacles(map)),
        zoom: diaryFocus ? Math.max(map.getZoom(), 12) : getLocationZoom(focusLocation),
        duration: quiet || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : motionMs.verySlow,
        essential: false
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusLocation, mapReady]);

  useEffect(() => {
    if (quiet) mapRef.current?.stop();
  }, [quiet]);

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
    <section
      className={`map-shell ${isMapMoving ? 'is-map-moving' : ''} ${lowPerformance ? 'low-performance-map' : ''} ${reducedMotion ? 'reduced-motion-map' : ''}`}
    >
      {MAPBOX_TOKEN ? (
        <div className="mapbox-container" ref={mapContainer} />
      ) : (
        <FallbackMap diaries={diaries} selectedId={selectedDiary?._id} currentLocation={currentLocation} onSelect={onSelect} />
      )}

      {mapReady && <DiaryMarkerLayer map={mapRef.current} diaries={diaries} geographicGroups={geographicGroups}
        theme={theme} selectedId={selectedDiary?._id} selectionToken={focusLocation?.focusId}
        onSelect={(diary) => onSelect(diary, { source: 'marker' })} reducedMotion={quiet} />}

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
                {...(quiet ? statusMotion : dropdownMotion(false))}
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
                {...(quiet ? statusMotion : dropdownMotion(false))}
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
            key="empty"
            className="map-empty subtle glass"
            {...statusMotion}
          >
            這片地圖還沒有留下記憶
          </motion.div>
        )}

        {loading && (
          <motion.div
            key="loading"
            className="map-loading"
            role="status"
            {...statusMotion}
          >
            <span className="button-spinner" aria-hidden="true" />
            <p>{mode === 'explore' ? '正在探索附近日記...' : '正在載入地圖日記...'}</p>
          </motion.div>
        )}

      </AnimatePresence>
    </section>
  );

  function zoomMap(delta) {
    const map = mapRef.current;
    if (!map) return;

    if (delta > 0) {
      map.zoomIn({ duration: quiet ? 0 : motionMs.fast, essential: false });
    } else {
      map.zoomOut({ duration: quiet ? 0 : motionMs.fast, essential: false });
    }
  }

  function resetPitch() {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      pitch: 0,
      duration: quiet ? 0 : motionMs.verySlow,
      essential: false
    });
  }

  function resetBearing() {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      bearing: 0,
      duration: quiet ? 0 : motionMs.verySlow,
      essential: false
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


function tuneBaseMapStyle(map, theme) {
  const layers = map.getStyle()?.layers || [];

  layers.forEach((layer) => {
    if (layer.type !== 'symbol') return;
    const id = layer.id || '';

    try {
      if (/poi/i.test(id)) {
        map.setPaintProperty(id, 'text-opacity', theme === 'bright' ? 0.58 : 0.65);
        map.setPaintProperty(id, 'icon-opacity', 0.35);
        return;
      }

      if (/road-label|natural-label|place-label|settlement|transit|airport/i.test(id)) {
        map.setPaintProperty(id, 'text-opacity', 0.85);
      }
    } catch {
      // Some Mapbox style layers do not expose the same paint/layout properties.
    }
  });
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
