import { useEffect, useMemo, useState } from 'react';

const LARGE_MARKER_COUNT = 80;

export function usePerformanceMode(markerCount = 0) {
  const [signals, setSignals] = useState(() => getPerformanceSignals());

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia?.('(max-width: 768px), (pointer: coarse)');

    function updateSignals() {
      setSignals(getPerformanceSignals());
    }

    reducedMotionQuery?.addEventListener('change', updateSignals);
    mobileQuery?.addEventListener('change', updateSignals);
    window.addEventListener('resize', updateSignals);

    return () => {
      reducedMotionQuery?.removeEventListener('change', updateSignals);
      mobileQuery?.removeEventListener('change', updateSignals);
      window.removeEventListener('resize', updateSignals);
    };
  }, []);

  return useMemo(() => {
    const manyMarkers = markerCount > LARGE_MARKER_COUNT;
    return {
      ...signals,
      manyMarkers,
      lowPerformance: signals.reducedMotion || signals.lowHardware || signals.mobile || manyMarkers
    };
  }, [markerCount, signals]);
}

function getPerformanceSignals() {
  const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const mobile = Boolean(window.matchMedia?.('(max-width: 768px), (pointer: coarse)').matches);
  const lowHardware = Number(navigator.hardwareConcurrency || 8) <= 4;

  return {
    reducedMotion,
    mobile,
    lowHardware
  };
}
