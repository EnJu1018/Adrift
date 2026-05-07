import { useCallback, useState } from 'react';
import { API_URL } from '../api/client.js';

const ipLocationUrl = 'https://ipwho.is/?fields=success,latitude,longitude,city,region,country,message';

const initialState = {
  lat: null,
  lng: null,
  accuracyType: '',
  source: '',
  city: '',
  region: '',
  country: '',
  loading: false,
  error: '',
  message: ''
};

export function useUserLocation() {
  const [state, setState] = useState(initialState);

  const locate = useCallback(async () => {
    setState((current) => ({
      ...current,
      loading: true,
      error: '',
      message: ''
    }));

    try {
      const location = await getBrowserLocation();
      setState({
        ...location,
        loading: false,
        error: '',
        message: '定位成功'
      });
      return location;
    } catch {
      try {
        const location = await getBackendIpLocation();
        setState({
          ...location,
          loading: false,
          error: '',
          message: '已使用大略位置'
        });
        return location;
      } catch {
        try {
          const location = await getIpLocation();
          setState({
            ...location,
            loading: false,
            error: '',
            message: '已使用大略位置'
          });
          return location;
        } catch {
          const error = '無法取得位置，請稍後再試';
          setState((current) => ({
            ...current,
            loading: false,
            error,
            message: ''
          }));
          throw new Error(error);
        }
      }
    }
  }, []);

  const clearLocationMessage = useCallback(() => {
    setState((current) => ({
      ...current,
      error: '',
      message: ''
    }));
  }, []);

  return {
    ...state,
    locate,
    clearLocationMessage
  };
}

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
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
        maximumAge: 0
      }
    );
  });
}

async function getIpLocation() {
  const response = await fetch(ipLocationUrl, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('IP location request failed');
  }

  const payload = await response.json();
  if (payload.success === false) {
    throw new Error(payload.message || 'IP location response failed');
  }

  const lat = Number(payload.latitude);
  const lng = Number(payload.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('IP location response is invalid');
  }

  return {
    lat,
    lng,
    accuracy: null,
    accuracyType: 'approximate',
    source: 'ip',
    city: payload.city || '',
    region: payload.region || '',
    country: payload.country || ''
  };
}

async function getBackendIpLocation() {
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
