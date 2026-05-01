import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Diary from '../models/Diary.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authorFields = 'name avatar userCode';
const reactionTypes = ['understand', 'hug', 'relate'];
const fallbackTitle = '（未命名日記）';

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

function getReactionCounts(diary) {
  return {
    understand: Math.max(0, diary.reactions?.understand || 0),
    hug: Math.max(0, diary.reactions?.hug || 0),
    relate: Math.max(0, diary.reactions?.relate || 0)
  };
}

function getUserReaction(diary, userId) {
  if (!userId) return null;

  const reaction = diary.reactedUsers?.find((item) => item.userId?.toString() === userId.toString());
  return reaction?.type || null;
}

function serializeDiary(diary, userId) {
  const output = diary.toObject ? diary.toObject() : { ...diary };
  output.title = output.title || fallbackTitle;
  output.reactions = getReactionCounts(diary);
  output.userReaction = getUserReaction(diary, userId);
  delete output.reactedUsers;
  return output;
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
    title: diary.title || fallbackTitle,
    content: diary.text,
    text: diary.text,
    mood: diary.mood,
    reactions: getReactionCounts(diary),
    userReaction: getUserReaction(diary, diary.user),
    images: imageUrls,
    imageUrl: diary.imageUrl || '',
    location: {
      lat,
      lng,
      placeName: diary.location?.placeName || ''
    },
    visibility: diary.visibility,
    createdAt: diary.createdAt
  };
}

function parseExploreQuery(query) {
  const parsedLat = Number(query.lat);
  const parsedLng = Number(query.lng);
  const parsedRadius = query.radius === undefined || query.radius === '' ? 5000 : Number(query.radius);

  if (![parsedLat, parsedLng, parsedRadius].every(Number.isFinite)) {
    return null;
  }

  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180 || parsedRadius <= 0) {
    return null;
  }

  return {
    lat: parsedLat,
    lng: parsedLng,
    radius: Math.min(parsedRadius, 50000)
  };
}

function serializeExploreDiary(diary, userId) {
  const [lng, lat] = diary.location?.coordinates || [];
  const author = diary.user
    ? {
        _id: diary.user._id,
        name: diary.user.name,
        userCode: diary.user.userCode,
        avatar: diary.user.avatar || ''
      }
    : null;

  return {
    _id: diary._id,
    title: diary.title || fallbackTitle,
    content: diary.text,
    text: diary.text,
    mood: diary.mood,
    reactions: getReactionCounts(diary),
    userReaction: getUserReaction(diary, userId),
    images: diary.imageUrl ? [diary.imageUrl] : [],
    imageUrl: diary.imageUrl || '',
    location: {
      type: 'Point',
      coordinates: diary.location?.coordinates || [],
      lat,
      lng,
      placeName: diary.location?.placeName || ''
    },
    visibility: diary.visibility,
    createdAt: diary.createdAt,
    author,
    user: author
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
      data: { diaries: diaries.map((diary) => serializeDiary(diary, req.user._id)) }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/explore', requireAuth, async (req, res) => {
  try {
    const location = parseExploreQuery(req.query);

    if (!location) {
      return res.status(400).json({
        success: false,
        message: '請提供有效的位置資訊'
      });
    }

    const diaries = await Diary.find({
      visibility: 'public',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [location.lng, location.lat]
          },
          $maxDistance: location.radius
        }
      }
    })
      .populate('user', authorFields)
      .limit(200);

    res.json({
      success: true,
      message: '取得附近日記成功',
      data: diaries.map((diary) => serializeExploreDiary(diary, req.user._id))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: '取得附近日記失敗'
    });
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
      data: { diaries: diaries.map((diary) => serializeDiary(diary, _req.user._id)) }
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

router.post('/:id/react', requireAuth, async (req, res, next) => {
  try {
    const { type } = req.body;

    if (!reactionTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: '不支援的共鳴類型'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: '找不到日記'
      });
    }

    const diary = await Diary.findOne({
      _id: req.params.id,
      ...diaryQueryForViewer(req.user)
    });

    if (!diary) {
      return res.status(404).json({
        success: false,
        message: '找不到日記'
      });
    }

    const reactions = getReactionCounts(diary);
    const existingReaction = diary.reactedUsers.find((item) => item.userId?.toString() === req.user._id.toString());

    if (!existingReaction) {
      reactions[type] += 1;
      diary.reactedUsers.push({ userId: req.user._id, type });
    } else if (existingReaction.type === type) {
      reactions[type] = Math.max(0, reactions[type] - 1);
      diary.reactedUsers.pull(existingReaction._id);
    } else {
      reactions[existingReaction.type] = Math.max(0, reactions[existingReaction.type] - 1);
      reactions[type] += 1;
      existingReaction.type = type;
    }

    diary.reactions = reactions;
    await diary.save();

    res.json({
      success: true,
      message: '已更新共鳴',
      data: {
        reactions: getReactionCounts(diary),
        userReaction: getUserReaction(diary, req.user._id)
      }
    });
  } catch (error) {
    next(error);
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
      data: { diary: serializeDiary(diary, req.user._id) }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const { title, text, content, moodType, moodIntensity, lat, lng, accuracy, visibility, placeName } = req.body;
    const diaryTitle = typeof title === 'string' ? title.trim() : '';
    const diaryText = typeof text === 'string' ? text.trim() : typeof content === 'string' ? content.trim() : '';

    if (!diaryTitle) {
      return res.status(400).json({
        success: false,
        message: '請輸入日記標題'
      });
    }

    if (diaryTitle.length > 50) {
      return res.status(400).json({
        success: false,
        message: '日記標題最多 50 字'
      });
    }

    if (!diaryText || !moodType || !moodIntensity || !lat || !lng) {
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
      title: diaryTitle,
      text: diaryText,
      mood: {
        type: moodType,
        intensity: parsedIntensity
      },
      imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
      location: {
        type: 'Point',
        coordinates: [parsedLng, parsedLat],
        placeName: typeof placeName === 'string' ? placeName.trim().slice(0, 120) : ''
      },
      locationAccuracy: parsedAccuracy,
      visibility: visibility || 'private'
    });

    const populatedDiary = await diary.populate('user', authorFields);
    res.status(201).json({
      success: true,
      message: '日記新增成功',
      data: { diary: serializeDiary(populatedDiary, req.user._id) }
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
