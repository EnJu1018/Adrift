import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '請先登入'
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '登入狀態已失效，請重新登入'
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: '登入狀態已失效，請重新登入'
    });
  }
}

export function requireAdminOrOwner(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.role === 'owner') {
    next();
    return;
  }

  return res.status(403).json({
    success: false,
    message: '沒有管理員權限'
  });
}

export function requireOwner(req, res, next) {
  if (req.user?.role === 'owner') {
    next();
    return;
  }

  return res.status(403).json({
    success: false,
    message: '只有 Owner 可以修改使用者權限'
  });
}
