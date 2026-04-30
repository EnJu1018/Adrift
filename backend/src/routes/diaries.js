import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Diary from '../models/Diary.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authorFields = 'name avatar userCode';

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      return callback(new Error('只允許上傳圖片'));
    }

    callback(null, true);
  }
});

function diaryQueryForViewer(user) {
  return {
    $or: [
      { user: user._id },
      { visibility: 'public' },
      {
        visibility: 'friends',
        user: { $in: user.friends || [] }
      }
    ]
  };
}

function buildLocationQuery(query, res) {
  const { lat, lng, radius } = query;

  if (!lat || !lng) {
    return {};
  }

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const parsedRadius = Number(radius || 50000);

  if (![parsedLat, parsedLng, parsedRadius].every(Number.isFinite)) {
    res.status(400).json({
      success: false,
      message: '座標與半徑必須是有效數字'
    });
    return null;
  }

  return {
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [parsedLng, parsedLat] },
        $maxDistance: Math.min(Math.max(parsedRadius, 1000), 200000)
      }
    }
  };
}

function serializeMemory(diary) {
  const [lng, lat] = diary.location?.coordinates || [];
  const imageUrls = diary.imageUrl ? [diary.imageUrl] : [];

  return {
    _id: diary._id,
    content: diary.text,
    text: diary.text,
    mood: diary.mood,
    images: imageUrls,
    imageUrl: diary.imageUrl || '',
    location: {
      lat,
      lng,
      placeName: ''
    },
    visibility: diary.visibility,
    createdAt: diary.createdAt
  };
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const locationQuery = buildLocationQuery(req.query, res);

    if (locationQuery === null) return;

    const diaries = await Diary.find({
      ...diaryQueryForViewer(req.user),
      ...locationQuery
    })
      .populate('user', authorFields)
      .sort(req.query.lat && req.query.lng ? undefined : { createdAt: -1 })
      .limit(200);

    res.json({
      success: true,
      message: '日記讀取成功',
      data: { diaries }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/public', requireAuth, async (_req, res, next) => {
  try {
    const diaries = await Diary.find({ visibility: 'public' })
      .populate('user', authorFields)
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({
      success: true,
      message: '公開日記讀取成功',
      data: { diaries }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/memories', requireAuth, async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDate = today.getDate();
    const currentYear = today.getFullYear();
    const startOfCurrentYear = new Date(currentYear, 0, 1);

    const diaries = await Diary.find({
      user: req.user._id,
      createdAt: { $lt: startOfCurrentYear }
    }).sort({ createdAt: -1 });

    const memories = diaries
      .filter((diary) => {
        const createdAt = new Date(diary.createdAt);

        return (
          createdAt.getMonth() === currentMonth &&
          createdAt.getDate() === currentDate &&
          createdAt.getFullYear() < currentYear
        );
      })
      .map(serializeMemory);

    res.json({
      success: true,
      message: memories.length > 0 ? '取得回憶成功' : '今天沒有過去的回憶',
      data: memories
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: '取得回憶失敗'
    });
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const diary = await Diary.findOne({
      _id: req.params.id,
      ...diaryQueryForViewer(req.user)
    }).populate('user', authorFields);

    if (!diary) {
      return res.status(404).json({
        success: false,
        message: '找不到日記'
      });
    }

    res.json({
      success: true,
      message: '日記讀取成功',
      data: { diary }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const { text, moodType, moodIntensity, lat, lng, accuracy, visibility } = req.body;

    if (!text?.trim() || !moodType || !moodIntensity || !lat || !lng) {
      return res.status(400).json({
        success: false,
        message: '請填寫日記內容、心情與位置'
      });
    }

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedIntensity = Number(moodIntensity);
    const parsedAccuracy = accuracy === undefined ? undefined : Number(accuracy);

    if (![parsedLat, parsedLng, parsedIntensity].every(Number.isFinite)) {
      return res.status(400).json({
        success: false,
        message: '位置與心情強度必須是有效數字'
      });
    }

    if (parsedIntensity < 1 || parsedIntensity > 5) {
      return res.status(400).json({
        success: false,
        message: '心情強度必須介於 1 到 5'
      });
    }

    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json({
        success: false,
        message: '位置座標超出有效範圍'
      });
    }

    if (parsedAccuracy !== undefined && (!Number.isFinite(parsedAccuracy) || parsedAccuracy < 0)) {
      return res.status(400).json({
        success: false,
        message: '定位精度必須是有效數字'
      });
    }

    const diary = await Diary.create({
      user: req.user._id,
      text: text.trim(),
      mood: {
        type: moodType,
        intensity: parsedIntensity
      },
      imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
      location: {
        type: 'Point',
        coordinates: [parsedLng, parsedLat]
      },
      locationAccuracy: parsedAccuracy,
      visibility: visibility || 'private'
    });

    const populatedDiary = await diary.populate('user', authorFields);
    res.status(201).json({
      success: true,
      message: '日記新增成功',
      data: { diary: populatedDiary }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const diary = await Diary.findById(req.params.id);

    if (!diary) {
      return res.status(404).json({
        success: false,
        message: '找不到日記'
      });
    }

    if (diary.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '只能刪除自己的日記'
      });
    }

    await diary.deleteOne();
    res.json({
      success: true,
      message: '日記已刪除'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
