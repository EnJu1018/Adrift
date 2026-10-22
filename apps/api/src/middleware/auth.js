import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import mongoose from 'mongoose';

export async function requireAuth(req, res, next) {
  let payload;
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '請先登入'
      });
    }

    payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!mongoose.isValidObjectId(payload.sub)) throw new Error('Invalid subject');
  } catch {
    return res.status(401).json({ success: false, message: '登入狀態已失效，請重新登入' });
  }
  try {
    const user = await User.findById(payload.sub).select('-passwordHash').maxTimeMS(5000);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '登入狀態已失效，請重新登入'
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(503).json({
      success: false,
      message: '帳號服務暫時無法使用，請稍後重試'
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
