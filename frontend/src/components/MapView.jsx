import mapboxgl from 'mapbox-gl';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import FallbackMap from './FallbackMap.jsx';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView({
  diaries,
  selectedDiary,
  onSelect,
  onViewportChange,
  focusLocation,
  mode = 'mine',
  expanded,
  loading,
  disabled
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const moveTimerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const diariesById = useMemo(() => {
    return new Map((diaries || []).map((diary) => [diary._id, diary]));
  }, [diaries]);

  const geoJson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: (diaries || [])
        .filter((diary) => Array.isArray(diary.location?.coordinates))
        .map((diary) => ({
          type: 'Feature',
          properties: {
            id: diary._id,
            mood: diary.mood?.type || 'other',
            explore: Boolean(diary.isExplore)
          },
          geometry: {
            type: 'Point',
            coordinates: diary.location.coordinates
          }
        }))
    };
  }, [diaries]);

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
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    map.on('load', () => {
      map.addSource('diaries', {
        type: 'geojson',
        data: geoJson,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 54
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
            'rgba(121, 241, 220, 0.74)',
            10,
            'rgba(79, 195, 255, 0.78)',
            40,
            'rgba(178, 120, 255, 0.82)'
          ],
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 40, 32],
          'circle-stroke-color': 'rgba(239, 251, 255, 0.72)',
          'circle-stroke-width': 1.4,
          'circle-blur': 0.1
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
          'text-size': 12
        },
        paint: {
          'text-color': '#02121b'
        }
      });

      map.addLayer({
        id: 'diary-points',
        type: 'circle',
        source: 'diaries',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            ['boolean', ['get', 'explore'], false],
            'rgba(154, 180, 255, 0.88)',
            '#78f3dc'
          ],
          'circle-radius': ['case', ['boolean', ['get', 'explore'], false], 8, 7],
          'circle-stroke-color': '#f5fcff',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.94,
          'circle-stroke-opacity': 0.86
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
    if (!map || !mapReady || !map.getLayer('diary-clusters')) return;

    map.setPaintProperty(
      'diary-clusters',
      'circle-color',
      mode === 'explore'
        ? [
            'step',
            ['get', 'point_count'],
            'rgba(154, 180, 255, 0.78)',
            10,
            'rgba(128, 179, 255, 0.82)',
            40,
            'rgba(178, 120, 255, 0.86)'
          ]
        : [
            'step',
            ['get', 'point_count'],
            'rgba(121, 241, 220, 0.74)',
            10,
            'rgba(79, 195, 255, 0.78)',
            40,
            'rgba(178, 120, 255, 0.82)'
          ]
    );
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

    function updateCursor() {
      map.getCanvas().style.cursor = 'pointer';
    }

    function resetCursor() {
      map.getCanvas().style.cursor = '';
    }

    map.on('click', 'diary-clusters', openCluster);
    map.on('click', 'diary-points', openDiary);
    map.on('mouseenter', 'diary-clusters', updateCursor);
    map.on('mouseenter', 'diary-points', updateCursor);
    map.on('mouseleave', 'diary-clusters', resetCursor);
    map.on('mouseleave', 'diary-points', resetCursor);

    return () => {
      map.off('click', 'diary-clusters', openCluster);
      map.off('click', 'diary-points', openDiary);
      map.off('mouseenter', 'diary-clusters', updateCursor);
      map.off('mouseenter', 'diary-points', updateCursor);
      map.off('mouseleave', 'diary-clusters', resetCursor);
      map.off('mouseleave', 'diary-points', resetCursor);
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
    if (!mapRef.current || !focusLocation) return;

    mapRef.current.easeTo({
      center: [focusLocation.lng, focusLocation.lat],
      zoom: Math.max(mapRef.current.getZoom(), mode === 'explore' ? 12 : 8),
      duration: 900
    });
  }, [focusLocation, mode]);

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
      className={`map-shell ${selectedDiary ? 'soft-blur' : ''}`}
      initial={{ opacity: 0, filter: 'blur(18px)' }}
      animate={{ opacity: 1, filter: selectedDiary ? 'blur(5px)' : 'blur(0px)' }}
      transition={{ duration: 1.1, ease: 'easeOut' }}
    >
      {MAPBOX_TOKEN ? (
        <div className="mapbox-container" ref={mapContainer} />
      ) : (
        <FallbackMap diaries={diaries} selectedId={selectedDiary?._id} onSelect={onSelect} />
      )}

      <AnimatePresence>
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
