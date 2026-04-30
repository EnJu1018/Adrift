import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();
const emailPattern = /^\S+@\S+\.\S+$/;
const userCodePattern = /^[a-zA-Z0-9_-]{4,20}$/;

function createToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
}

function serializeUser(user) {
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    userCode: user.userCode || '',
    avatar: user.avatar || '',
    createdAt: user.createdAt
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, userCode } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();
    const normalizedUserCode = userCode?.toLowerCase().trim();

    if (!name?.trim() || !normalizedEmail || !password || !normalizedUserCode) {
      return res.status(400).json({
        success: false,
        message: '請填寫所有必填欄位'
      });
    }

    if (name.trim().length < 2 || name.trim().length > 30) {
      return res.status(400).json({
        success: false,
        message: '使用者名稱長度需為 2 到 30 字元'
      });
    }

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Email 格式不正確'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密碼至少需要 6 個字元'
      });
    }

    if (!userCodePattern.test(normalizedUserCode)) {
      return res.status(400).json({
        success: false,
        message: '使用者 ID 只能包含英文、數字、底線、減號，長度需為 4 到 20 字元'
      });
    }

    const [existingEmail, existingUserCode] = await Promise.all([
      User.findOne({ email: normalizedEmail }),
      User.findOne({ userCode: normalizedUserCode })
    ]);

    if (existingUserCode) {
      return res.status(409).json({
        success: false,
        message: '此使用者 ID 已被使用'
      });
    }

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: '此 Email 已被註冊'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      userCode: normalizedUserCode,
      passwordHash
    });

    res.status(201).json({
      success: true,
      message: '註冊成功，請登入',
      data: {
        user: serializeUser(user)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: '請輸入 Email 和密碼'
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '此帳號不存在'
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: '密碼錯誤'
      });
    }

    const token = createToken(user);
    const serializedUser = serializeUser(user);

    res.json({
      success: true,
      message: '登入成功',
      token,
      user: serializedUser,
      data: {
        token,
        user: serializedUser
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
