import mapboxgl from 'mapbox-gl';
import { AnimatePresence, motion } from 'framer-motion';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  disabled
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const moveTimerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
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
            'rgba(121, 241, 220, 0.74)',
            10,
            'rgba(79, 195, 255, 0.78)',
            40,
            'rgba(178, 120, 255, 0.82)'
          ],
          'circle-radius': ['step', ['get', 'point_count'], 28, 10, 36, 40, 46],
          'circle-opacity': 0.42,
          'circle-blur': 0.58
        }
      });

      map.addLayer({
        id: 'diary-clusters',
        type: 'circle',
        source: 'diaries',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': 'rgba(7, 20, 34, 0.76)',
          'circle-radius': ['step', ['get', 'point_count'], 21, 10, 27, 40, 34],
          'circle-stroke-color': 'rgba(239, 251, 255, 0.72)',
          'circle-stroke-width': 1.4,
          'circle-blur': 0.04
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
          'text-color': '#ecfbff',
          'text-halo-color': 'rgba(77, 197, 255, 0.38)',
          'text-halo-width': 0.8
        }
      });

      map.addLayer({
        id: 'diary-approximate-areas',
        type: 'circle',
        source: 'diaries',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'approximate'], true]],
        paint: {
          'circle-color': 'rgba(154, 180, 255, 0.16)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 18, 8, 38, 12, 88, 16, 170],
          'circle-stroke-color': 'rgba(210, 225, 255, 0.42)',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 12, 1.3, 16, 1.8],
          'circle-opacity': 0.62,
          'circle-blur': 0.52
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
            27,
            ['boolean', ['get', 'hovered'], false],
            24,
            ['boolean', ['get', 'approximate'], false],
            24,
            20
          ],
          'circle-opacity': [
            'case',
            ['boolean', ['get', 'selected'], false],
            0.76,
            ['boolean', ['get', 'hovered'], false],
            0.62,
            ['boolean', ['get', 'approximate'], false],
            0.42,
            0.5
          ],
          'circle-blur': 0.58
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
          'circle-color': ['get', 'markerGlassColor'],
          'circle-radius': [
            'case',
            ['boolean', ['get', 'selected'], false],
            15,
            ['boolean', ['get', 'hovered'], false],
            14,
            ['boolean', ['get', 'approximate'], false],
            13,
            12
          ],
          'circle-stroke-color': [
            'case',
            ['boolean', ['get', 'selected'], false],
            '#ffffff',
            ['get', 'markerColor']
          ],
          'circle-stroke-width': [
            'case',
            ['boolean', ['get', 'selected'], false],
            2.4,
            ['boolean', ['get', 'hovered'], false],
            2,
            ['boolean', ['get', 'approximate'], false],
            1.15,
            1.45
          ],
          'circle-opacity': ['case', ['boolean', ['get', 'approximate'], false], 0.72, 0.96],
          'circle-stroke-opacity': ['case', ['boolean', ['get', 'approximate'], false], 0.58, 0.86],
          'circle-blur': ['case', ['boolean', ['get', 'approximate'], false], 0.08, 0.01],
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
          'circle-color': ['get', 'markerCoreColor'],
          'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 8, 7],
          'circle-opacity': ['case', ['boolean', ['get', 'approximate'], false], 0.44, 0.72],
          'circle-blur': 0.18
        }
      });

      map.addLayer({
        id: 'diary-selected-ring',
        type: 'circle',
        source: 'diaries',
        filter: ['all', ['!', ['has', 'point_count']], ['any', ['==', ['get', 'selected'], true], ['==', ['get', 'hovered'], true]]],
        paint: {
          'circle-color': 'rgba(255, 255, 255, 0)',
          'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 19, 17],
          'circle-stroke-color': ['get', 'markerColor'],
          'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 1.8, 1.1],
          'circle-stroke-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.88, 0.52],
          'circle-blur': 0.08
        }
      });

      map.addLayer({
        id: 'diary-marker-icon',
        type: 'symbol',
        source: 'diaries',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'moodIcon'],
          'text-font': ['Arial Unicode MS Regular', 'DIN Offc Pro Medium'],
          'symbol-sort-key': ['case', ['boolean', ['get', 'selected'], false], 3, ['boolean', ['get', 'hovered'], false], 2, 1],
          'text-size': [
            'case',
            ['boolean', ['get', 'selected'], false],
            15,
            ['boolean', ['get', 'hovered'], false],
            14,
            13
          ],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#f8fdff',
          'text-halo-color': 'rgba(0, 8, 16, 0.58)',
          'text-halo-width': 1.1,
          'text-opacity': ['case', ['boolean', ['get', 'approximate'], false], 0.78, 1]
        }
      });

      map.addLayer({
        id: 'current-location-radius',
        type: 'circle',
        source: 'current-location',
        filter: ['==', ['get', 'approximate'], true],
        paint: {
          'circle-color': 'rgba(106, 156, 255, 0.13)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 14, 8, 36, 12, 86, 16, 180],
          'circle-stroke-color': 'rgba(172, 204, 255, 0.38)',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 12, 1.4, 16, 2],
          'circle-blur': 0.42
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
            'rgba(154, 180, 255, 0.2)',
            'rgba(121, 241, 220, 0.22)'
          ],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 18, 15, 30],
          'circle-opacity': 0.78,
          'circle-blur': 0.28
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
            'rgba(154, 180, 255, 0.92)',
            '#8bffe9'
          ],
          'circle-radius': ['case', ['boolean', ['get', 'approximate'], false], 7, 6],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': ['case', ['boolean', ['get', 'approximate'], false], 0.74, 1],
          'circle-blur': ['case', ['boolean', ['get', 'approximate'], false], 0.12, 0]
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
    map.on('click', 'diary-marker-icon', openDiary);
    map.on('mouseenter', 'diary-cluster-glow', updateCursor);
    map.on('mouseenter', 'diary-clusters', updateCursor);
    map.on('mouseenter', 'diary-cluster-count', updateCursor);
    map.on('mouseenter', 'diary-marker-shell', showDiaryHover);
    map.on('mouseenter', 'diary-marker-icon', showDiaryHover);
    map.on('mouseleave', 'diary-cluster-glow', resetCursor);
    map.on('mouseleave', 'diary-clusters', resetCursor);
    map.on('mouseleave', 'diary-cluster-count', resetCursor);
    map.on('mouseleave', 'diary-marker-shell', hideDiaryHover);
    map.on('mouseleave', 'diary-marker-icon', hideDiaryHover);

    return () => {
      map.off('click', 'diary-cluster-glow', openCluster);
      map.off('click', 'diary-clusters', openCluster);
      map.off('click', 'diary-cluster-count', openCluster);
      map.off('click', 'diary-marker-shell', openDiary);
      map.off('click', 'diary-marker-icon', openDiary);
      map.off('mouseenter', 'diary-cluster-glow', updateCursor);
      map.off('mouseenter', 'diary-clusters', updateCursor);
      map.off('mouseenter', 'diary-cluster-count', updateCursor);
      map.off('mouseenter', 'diary-marker-shell', showDiaryHover);
      map.off('mouseenter', 'diary-marker-icon', showDiaryHover);
      map.off('mouseleave', 'diary-cluster-glow', resetCursor);
      map.off('mouseleave', 'diary-clusters', resetCursor);
      map.off('mouseleave', 'diary-cluster-count', resetCursor);
      map.off('mouseleave', 'diary-marker-shell', hideDiaryHover);
      map.off('mouseleave', 'diary-marker-icon', hideDiaryHover);
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
    if (!mapRef.current || !selectedDiary) return;

    mapRef.current.easeTo({
      center: selectedDiary.location.coordinates,
      zoom: Math.max(mapRef.current.getZoom(), 8),
      duration: 900
    });
  }, [selectedDiary]);

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

  return (
    <motion.section
      className="map-shell"
      initial={{ opacity: 0, filter: 'blur(18px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 1.1, ease: 'easeOut' }}
    >
      {MAPBOX_TOKEN ? (
        <div className="mapbox-container" ref={mapContainer} />
      ) : (
        <FallbackMap diaries={diaries} selectedId={selectedDiary?._id} currentLocation={currentLocation} onSelect={onSelect} />
      )}

      <div className="map-controls glass" aria-label="地圖控制">
        <button type="button" onClick={() => zoomMap(1)} disabled={!MAPBOX_TOKEN || !mapReady} aria-label="放大地圖">
          <Plus size={17} />
        </button>
        <button type="button" onClick={() => zoomMap(-1)} disabled={!MAPBOX_TOKEN || !mapReady} aria-label="縮小地圖">
          <Minus size={17} />
        </button>
        <button
          type="button"
          className="locate"
          onClick={onLocateUser}
          disabled={locating}
          aria-label="定位目前位置"
        >
          {locating ? <span className="button-spinner" /> : <LocateFixed size={17} />}
        </button>
      </div>

      <AnimatePresence>
        {!loading && !disabled && diaries.length === 0 && (
          <motion.div
            className="map-empty subtle glass"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            這片地圖還沒有留下記憶
          </motion.div>
        )}

        {loading && (
          <motion.div
            className="map-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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

    map.easeTo({
      zoom: map.getZoom() + delta,
      duration: 260,
      essential: true
    });
  }
}

function getLocationZoom(location) {
  return location?.accuracyType === 'approximate' || location?.source === 'ip' ? 11 : 15;
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
    const displayCoordinates = offsetOverlappingCoordinates(coordinates, groupIndex, group.length);
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
        markerGlowColor: markerStyle.glow,
        markerGlassColor: markerStyle.glass,
        markerCoreColor: markerStyle.core,
        explore: Boolean(diary.isExplore),
        selected: diary._id === selectedId,
        hovered: diary._id === hoveredId,
        approximate: locationAccuracy === 'approximate',
        overlapCount: group.length
      },
      geometry: {
        type: 'Point',
        coordinates: displayCoordinates
      }
    };
  });
}

function normalizeLocationAccuracy(value) {
  return value === 'approximate' ? 'approximate' : 'precise';
}

function offsetOverlappingCoordinates(coordinates, index, total) {
  const [lng, lat] = coordinates.map(Number);

  if (total <= 1 || index < 0) {
    return [lng, lat];
  }

  const radiusMeters = Math.min(72, 18 + total * 4);
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const latOffset = (Math.sin(angle) * radiusMeters) / 111320;
  const lngScale = Math.max(Math.cos(toRadians(lat)), 0.18);
  const lngOffset = (Math.cos(angle) * radiusMeters) / (111320 * lngScale);

  return [lng + lngOffset, lat + latOffset];
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
