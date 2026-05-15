import { GoogleGenerativeAI } from '@google/generative-ai';
import Diary from '../models/Diary.js';
import User from '../models/User.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const CANDIDATE_LIMIT = 120;
const DIARY_LOOKBACK_DAYS = 90;
const DIARY_LIMIT = 600;
const NEARBY_DISTANCE_METERS = 25000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

export function parseRecommendationLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

export async function getFriendRecommendations(currentUserId, options = {}) {
  const limit = parseRecommendationLimit(options.limit);
  const since = new Date(Date.now() - DIARY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const currentUser = await User.findById(currentUserId).select('friends friendRequests');

  if (!currentUser) {
    return [];
  }

  const currentId = currentUser._id.toString();
  const friendIds = toIdSet(currentUser.friends);
  const receivedRequestIds = new Set(
    (currentUser.friendRequests || [])
      .filter((request) => request.status === 'pending')
      .map((request) => request.from.toString())
  );
  const sentRequestUsers = await User.find({
    friendRequests: {
      $elemMatch: {
        from: currentUser._id,
        status: 'pending'
      }
    }
  }).select('_id');
  const sentRequestIds = toIdSet(sentRequestUsers.map((user) => user._id));
  const excludedIds = new Set([currentId, ...friendIds, ...receivedRequestIds, ...sentRequestIds]);

  const candidates = await User.find({
    _id: { $nin: [...excludedIds] },
    role: { $nin: ['admin', 'owner'] }
  })
    .select('_id name userCode avatar friends createdAt')
    .limit(CANDIDATE_LIMIT);

  if (candidates.length === 0) {
    return [];
  }

  const candidateIds = candidates.map((candidate) => candidate._id);
  const [currentDiaries, candidateDiaries] = await Promise.all([
    Diary.find({
      user: currentUser._id,
      visibility: 'public',
      createdAt: { $gte: since }
    })
      .select('mood location createdAt')
      .sort({ createdAt: -1 })
      .limit(DIARY_LIMIT),
    Diary.find({
      user: { $in: candidateIds },
      visibility: 'public',
      createdAt: { $gte: since }
    })
      .select('user mood location createdAt')
      .sort({ createdAt: -1 })
      .limit(DIARY_LIMIT)
  ]);

  const currentMoodSet = getMoodSet(currentDiaries);
  const candidateDiaryMap = groupDiariesByUser(candidateDiaries);
  const recommendations = candidates
    .map((candidate) =>
      scoreCandidate({
        candidate,
        currentUser,
        currentDiaries,
        currentMoodSet,
        candidateDiaries: candidateDiaryMap.get(candidate._id.toString()) || [],
        friendIds
      })
    )
    .filter((recommendation) => recommendation.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return enrichRecommendationReasons(recommendations);
}

function scoreCandidate({ candidate, currentUser, currentDiaries, currentMoodSet, candidateDiaries, friendIds }) {
  const candidateFriendIds = toIdSet(candidate.friends || []);
  const mutualFriendsCount = [...candidateFriendIds].filter((id) => friendIds.has(id)).length;
  const candidateMoodSet = getMoodSet(candidateDiaries);
  const sharedMoods = [...candidateMoodSet].filter((mood) => currentMoodSet.has(mood)).slice(0, 4);
  const nearby = getNearbyDiarySignals(currentDiaries, candidateDiaries);
  const publicDiaryCount = candidateDiaries.length;
  const recentActivityScore = getRecentActivityScore(candidateDiaries);
  const score =
    mutualFriendsCount * 10 +
    sharedMoods.length * 5 +
    nearby.count * 6 +
    recentActivityScore +
    Math.min(publicDiaryCount, 5);
  const reasons = buildRuleReasons({
    mutualFriendsCount,
    sharedMoods,
    nearbyPlaces: nearby.places,
    recentActivityScore,
    publicDiaryCount
  });

  return {
    _id: candidate._id,
    name: candidate.name,
    userCode: candidate.userCode || '',
    avatar: candidate.avatar || '',
    score,
    reasons,
    mutualFriendsCount,
    sharedMoods,
    nearbyPlaces: nearby.places,
    publicDiaryCount
  };
}

async function enrichRecommendationReasons(recommendations) {
  if (!process.env.GEMINI_API_KEY || recommendations.length === 0) {
    return recommendations.map(serializeRecommendation);
  }

  const enriched = await Promise.all(
    recommendations.map(async (recommendation) => {
      try {
        const aiReason = await generateFriendRecommendationReason(recommendation);
        if (!aiReason) return recommendation;

        return {
          ...recommendation,
          reasons: [aiReason, ...recommendation.reasons].slice(0, 3)
        };
      } catch {
        return recommendation;
      }
    })
  );

  return enriched.map(serializeRecommendation);
}

export async function generateFriendRecommendationReason(recommendation) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.35
    }
  });
  const prompt = [
    '你是 Adrift 的好友推薦助手。',
    '請根據以下資料，產生一句自然、溫和、不冒犯隱私的推薦理由。',
    '不要提及過度敏感資訊。',
    '不要做心理分析或人格判斷。',
    '請使用繁體中文。',
    '請限制在 30 字以內。',
    '',
    `共同好友數量：${recommendation.mutualFriendsCount}`,
    `相似心情：${recommendation.sharedMoods.join(', ') || '無'}`,
    `相近地點：${recommendation.nearbyPlaces.join(', ') || '無'}`,
    `最近活躍狀態：${recommendation.publicDiaryCount > 0 ? '最近有公開日記' : '無公開日記'}`
  ].join('\n');
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/^["「]|["」]$/g, '').trim();

  return text.length > 38 ? `${text.slice(0, 35)}...` : text;
}

function serializeRecommendation(recommendation) {
  return {
    _id: recommendation._id,
    name: recommendation.name,
    userCode: recommendation.userCode,
    avatar: recommendation.avatar,
    score: Math.round(recommendation.score),
    reasons: recommendation.reasons,
    mutualFriendsCount: recommendation.mutualFriendsCount,
    sharedMoods: recommendation.sharedMoods,
    nearbyPlaces: recommendation.nearbyPlaces
  };
}

function buildRuleReasons({ mutualFriendsCount, sharedMoods, nearbyPlaces, recentActivityScore, publicDiaryCount }) {
  const reasons = [];

  if (mutualFriendsCount > 0) {
    reasons.push(`你們有 ${mutualFriendsCount} 位共同好友`);
  }

  if (nearbyPlaces.length > 0) {
    reasons.push(`你們都常在${nearbyPlaces[0]}附近留下日記`);
  }

  if (sharedMoods.length > 0) {
    reasons.push(`你們最近都常記錄 ${sharedMoods[0]} 心情`);
  }

  if (recentActivityScore > 0) {
    reasons.push('對方最近仍有公開日記更新');
  }

  if (reasons.length === 0 && publicDiaryCount > 0) {
    reasons.push('對方有一些公開日記可以認識');
  }

  return reasons.slice(0, 3);
}

function groupDiariesByUser(diaries) {
  return diaries.reduce((groups, diary) => {
    const userId = diary.user?.toString();
    const group = groups.get(userId) || [];
    group.push(diary);
    groups.set(userId, group);
    return groups;
  }, new Map());
}

function getMoodSet(diaries) {
  return new Set(diaries.map((diary) => diary.mood?.type).filter(Boolean));
}

function getNearbyDiarySignals(currentDiaries, candidateDiaries) {
  const places = new Set();
  let count = 0;

  for (const currentDiary of currentDiaries) {
    const currentCoordinates = getCoordinates(currentDiary);
    if (!currentCoordinates) continue;

    for (const candidateDiary of candidateDiaries) {
      const candidateCoordinates = getCoordinates(candidateDiary);
      if (!candidateCoordinates) continue;

      if (distanceMeters(currentCoordinates, candidateCoordinates) <= NEARBY_DISTANCE_METERS) {
        count += 1;
        const place = normalizePlaceName(candidateDiary.location?.placeName || currentDiary.location?.placeName);
        if (place) places.add(place);
      }

      if (count >= 3) break;
    }

    if (count >= 3) break;
  }

  return {
    count,
    places: [...places].slice(0, 3)
  };
}

function getRecentActivityScore(diaries) {
  const latestTime = diaries.reduce((latest, diary) => Math.max(latest, new Date(diary.createdAt).getTime()), 0);
  if (!latestTime) return 0;

  const daysSinceLatest = (Date.now() - latestTime) / (24 * 60 * 60 * 1000);
  if (daysSinceLatest <= 7) return 8;
  if (daysSinceLatest <= 30) return 5;
  if (daysSinceLatest <= 90) return 2;
  return 0;
}

function getCoordinates(diary) {
  const [lng, lat] = diary.location?.coordinates || [];
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lat, lng };
}

function normalizePlaceName(value) {
  if (!value || typeof value !== 'string') return '';
  return value.split(/[、,，]/)[0].trim().slice(0, 18);
}

function toIdSet(values) {
  return new Set((values || []).map((value) => value?._id?.toString?.() || value?.toString?.()).filter(Boolean));
}

function distanceMeters(left, right) {
  const radius = 6371000;
  const phi1 = toRadians(left.lat);
  const phi2 = toRadians(right.lat);
  const deltaPhi = toRadians(right.lat - left.lat);
  const deltaLng = toRadians(right.lng - left.lng);
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
