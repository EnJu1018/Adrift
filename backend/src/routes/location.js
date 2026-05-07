import express from 'express';

const router = express.Router();
const ipLocationProviders = [
  {
    url: 'http://ip-api.com/json/?fields=status,message,lat,lon,city,regionName,country',
    normalize(payload) {
      if (payload.status !== 'success') {
        throw new Error(payload.message || 'ip-api failed');
      }

      return {
        lat: payload.lat,
        lng: payload.lon,
        city: payload.city,
        region: payload.regionName,
        country: payload.country
      };
    }
  },
  {
    url: 'https://ipwho.is/?fields=success,latitude,longitude,city,region,country,message',
    normalize(payload) {
      if (payload.success === false) {
        throw new Error(payload.message || 'ipwho.is failed');
      }

      return {
        lat: payload.latitude,
        lng: payload.longitude,
        city: payload.city,
        region: payload.region,
        country: payload.country
      };
    }
  }
];

router.get('/ip', async (_req, res) => {
  try {
    const location = await getIpLocation();

    res.json({
      success: true,
      message: '已使用大略位置',
      data: {
        lat: location.lat,
        lng: location.lng,
        accuracyType: 'approximate',
        source: 'ip',
        city: location.city || '',
        region: location.region || '',
        country: location.country || ''
      }
    });
  } catch (error) {
    console.error('IP location failed:', error);
    res.status(503).json({
      success: false,
      message: '無法取得位置，請稍後再試'
    });
  }
});

async function getIpLocation() {
  const errors = [];

  for (const provider of ipLocationProviders) {
    try {
      const response = await fetch(provider.url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Adrift/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`provider responded ${response.status}`);
      }

      const payload = await response.json();
      const normalized = provider.normalize(payload);
      const lat = Number(normalized.lat);
      const lng = Number(normalized.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('provider returned invalid coordinates');
      }

      return {
        ...normalized,
        lat,
        lng
      };
    } catch (error) {
      errors.push(`${provider.url}: ${error.message}`);
    }
  }

  throw new Error(errors.join(' | '));
}

export default router;
