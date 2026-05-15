import { useCallback, useRef, useState } from 'react';
import { API_URL } from '../api/client.js';

const LOCATION_CACHE_TTL = 5 * 60 * 1000;
const IP_LOCATION_TIMEOUT = 7000;

const browserIpLocationProviders = [
  {
    url: 'https://ipwho.is/?fields=success,latitude,longitude,city,region,country,message',
    normalize(payload) {
      if (payload.success === false) {
        throw new Error(payload.message || 'IP location response failed');
      }

      return {
        lat: payload.latitude,
        lng: payload.longitude,
        city: payload.city,
        region: payload.region,
        country: payload.country
      };
    }
  },
  {
    url: 'https://ipapi.co/json/',
    normalize(payload) {
      if (payload.error) {
        throw new Error(payload.reason || 'IP location response failed');
      }

      return {
        lat: payload.latitude,
        lng: payload.longitude,
        city: payload.city,
        region: payload.region,
        country: payload.country_name
      };
    }
  },
  {
    url: 'https://ipinfo.io/json',
    normalize(payload) {
      const [lat, lng] = typeof payload.loc === 'string' ? payload.loc.split(',') : [];

      return {
        lat,
        lng,
        city: payload.city,
        region: payload.region,
        country: payload.country
      };
    }
  }
];

const initialState = {
  lat: null,
  lng: null,
  accuracy: null,
  accuracyType: '',
  source: '',
  city: '',
  region: '',
  country: '',
  loading: false,
  error: '',
  message: '',
  initialized: false,
  lastUpdatedAt: null
};

export function useUserLocation() {
  const [state, setState] = useState(initialState);
  const locationRef = useRef(null);
  const requestRef = useRef(null);
  const approximateNoticeShownRef = useRef(false);

  const commitLocation = useCallback((location, options = {}) => {
    const nextLocation = {
      ...location,
      loading: false,
      error: '',
      message: getLocationMessage(location, options, approximateNoticeShownRef),
      initialized: true,
      lastUpdatedAt: Date.now()
    };

    locationRef.current = nextLocation;
    setState(nextLocation);
    return nextLocation;
  }, []);

  const resolveLocation = useCallback(
    async (options = {}) => {
      if (!options.silent) {
        setState((current) => ({
          ...current,
          loading: true,
          error: '',
          message: ''
        }));
      } else {
        setState((current) => ({
          ...current,
          error: '',
          message: ''
        }));
      }

      try {
        const location = await getLocationWithFallback();
        return commitLocation(location, options);
      } catch {
        const cached = locationRef.current;
        const error =
          cached && options.keepPreviousOnError
            ? '無法更新目前位置，已保留上次位置'
            : '無法取得位置';

        setState((current) => ({
          ...(cached || current),
          loading: false,
          error,
          message: '',
          initialized: Boolean(cached || current.initialized)
        }));

        throw new Error(error);
      }
    },
    [commitLocation]
  );

  const getLocation = useCallback(
    async (options = {}) => {
      const cached = locationRef.current;

      if (cached && isFreshLocation(cached)) {
        return cached;
      }

      if (cached) {
        if (!requestRef.current) {
          requestRef.current = resolveLocation({
            silent: true,
            keepPreviousOnError: true
          })
            .catch(() => locationRef.current)
            .finally(() => {
              requestRef.current = null;
            });
        }

        return cached;
      }

      if (!requestRef.current) {
        requestRef.current = resolveLocation({
          ...options,
          showMessage: options.showMessage ?? true
        }).finally(() => {
          requestRef.current = null;
        });
      }

      return requestRef.current;
    },
    [resolveLocation]
  );

  const refreshLocation = useCallback(
    async (options = {}) => {
      if (!requestRef.current) {
        requestRef.current = resolveLocation({
          ...options,
          showMessage: true,
          forceMessage: true,
          keepPreviousOnError: true
        }).finally(() => {
          requestRef.current = null;
        });
      }

      return requestRef.current;
    },
    [resolveLocation]
  );

  const clearLocationMessage = useCallback(() => {
    setState((current) => ({
      ...current,
      error: '',
      message: ''
    }));
  }, []);

  const location = isValidCoordinates(state)
    ? {
        lat: state.lat,
        lng: state.lng,
        accuracy: state.accuracy,
        accuracyType: state.accuracyType,
        source: state.source,
        city: state.city,
        region: state.region,
        country: state.country,
        lastUpdatedAt: state.lastUpdatedAt
      }
    : null;

  return {
    ...state,
    location,
    getLocation,
    refreshLocation,
    locate: getLocation,
    clearLocationMessage
  };
}

async function getLocationWithFallback() {
  if (canUseBrowserGeolocation()) {
    try {
      return await getBrowserLocation();
    } catch {
      // Continue to approximate IP fallback below.
    }
  }

  try {
    return await getBrowserIpLocation();
  } catch {
    return getBackendClientIpLocation();
  }
}

function getLocationMessage(location, options, approximateNoticeShownRef) {
  if (options.silent) return '';

  if (location.accuracyType === 'approximate') {
    if (!options.forceMessage && approximateNoticeShownRef.current) return '';
    approximateNoticeShownRef.current = true;
    return options.approximateMessage || '已使用大略位置';
  }

  return options.preciseMessage || (options.showMessage ? '定位成功' : '');
}

function isFreshLocation(location) {
  return Boolean(location?.lastUpdatedAt && Date.now() - location.lastUpdatedAt < LOCATION_CACHE_TTL);
}

function isValidCoordinates(location) {
  return Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng));
}

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!canUseBrowserGeolocation()) {
      reject(new Error('Browser geolocation is not available'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          accuracyType: 'precise',
          source: 'browser',
          city: '',
          region: '',
          country: ''
        });
      },
      () => reject(new Error('Browser geolocation failed')),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: LOCATION_CACHE_TTL
      }
    );
  });
}

async function getBrowserIpLocation() {
  const errors = [];

  for (const provider of browserIpLocationProviders) {
    try {
      const payload = await fetchJson(provider.url, IP_LOCATION_TIMEOUT);
      const normalized = provider.normalize(payload);
      const lat = Number(normalized.lat);
      const lng = Number(normalized.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('IP location response is invalid');
      }

      return {
        lat,
        lng,
        accuracy: null,
        accuracyType: 'approximate',
        source: 'ip',
        city: normalized.city || '',
        region: normalized.region || '',
        country: normalized.country || ''
      };
    } catch (error) {
      errors.push(`${provider.url}: ${error.message}`);
    }
  }

  throw new Error(errors.join(' | ') || 'IP location request failed');
}

async function fetchJson(url, timeout) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`IP location request failed: ${response.status}`);
    }

    return response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function canUseBrowserGeolocation() {
  if (!navigator.geolocation) return false;
  if (window.isSecureContext) return true;

  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

async function getBackendClientIpLocation() {
  const response = await fetch(`${API_URL}/location/ip`, {
    headers: {
      Accept: 'application/json'
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || 'Backend IP location request failed');
  }

  const data = payload.data || {};
  const lat = Number(data.lat);
  const lng = Number(data.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Backend IP location response is invalid');
  }

  return {
    lat,
    lng,
    accuracy: null,
    accuracyType: 'approximate',
    source: 'ip',
    city: data.city || '',
    region: data.region || '',
    country: data.country || ''
  };
}
