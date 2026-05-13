import express from 'express';

const router = express.Router();

const ipLocationProviders = [
  {
    buildUrl(ip) {
      return `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,lat,lon,city,regionName,country`;
    },
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
    buildUrl(ip) {
      return `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,latitude,longitude,city,region,country,message`;
    },
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

router.get('/ip', async (req, res) => {
  try {
    const clientIp = getClientIp(req);

    if (!clientIp) {
      return res.status(400).json({
        success: false,
        message: '無法取得使用者 IP 位置'
      });
    }

    const location = await getIpLocation(clientIp);

    return res.json({
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
  } catch {
    return res.status(503).json({
      success: false,
      message: '無法取得位置，請稍後再試'
    });
  }
});

async function getIpLocation(ip) {
  const errors = [];

  for (const provider of ipLocationProviders) {
    try {
      const response = await fetch(provider.buildUrl(ip), {
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
      errors.push(`${provider.buildUrl(ip)}: ${error.message}`);
    }
  }

  throw new Error(errors.join(' | '));
}

function getClientIp(req) {
  const candidates = [
    req.headers['cf-connecting-ip'],
    req.headers['x-real-ip'],
    firstForwardedIp(req.headers['x-forwarded-for']),
    req.socket?.remoteAddress,
    req.ip
  ];

  return candidates.map(normalizeIp).find(isPublicIp) || '';
}

function firstForwardedIp(value) {
  if (!value || Array.isArray(value)) return '';
  return value.split(',')[0]?.trim() || '';
}

function normalizeIp(value) {
  if (!value || typeof value !== 'string') return '';
  const ip = value.trim().replace(/^::ffff:/, '');
  return ip === '::1' ? '127.0.0.1' : ip;
}

function isPublicIp(ip) {
  if (!ip || ip === 'unknown') return false;
  if (ip === '127.0.0.1' || ip === '::1') return false;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return false;
  if (ip.startsWith('169.254.')) return false;
  return true;
}

export default router;
