import express from "express";
import Notification from "../models/Notification.js";
import Diary from "../models/Diary.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createSocialLimiter,
  publicPersonFields,
  validPersonId,
  socialError,
} from "../services/friendRelationships.js";
import { cursorQuery, pageCursor } from "../utils/cursor.js";
import { canViewDiary, notifyNotificationChange } from "./diaries.js";

const router = express.Router();
router.use(requireAuth, createSocialLimiter(120));
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.get("/", async (req, res, next) => {
  try {
    const scope = { recipient: req.user._id };
    const [rows, unreadCount] = await Promise.all([
      Notification.find({ $and: [scope, cursorQuery(req.query.cursor)] })
        .sort({ createdAt: -1, _id: -1 })
        .limit(21)
        .populate("actor", publicPersonFields)
        .lean(),
      Notification.countDocuments({ ...scope, readAt: null }),
    ]);
    res.json({
      success: true,
      data: {
        items: rows.slice(0, 20),
        nextCursor: pageCursor(rows, 20),
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
});
router.patch("/read-all", async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, readAt: null },
      { $set: { readAt: new Date() } },
    );
    notifyNotificationChange([req.user._id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
router.patch("/:id/read", async (req, res, next) => {
  try {
    validPersonId(req.params.id);
    const row = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!row) throw socialError("找不到通知", 404);
    notifyNotificationChange([req.user._id]);
    res.json({ success: true, data: { readAt: row.readAt } });
  } catch (error) {
    next(error);
  }
});
router.get("/:id/target", async (req, res, next) => {
  try {
    validPersonId(req.params.id);
    const row = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id,
    }).lean();
    if (!row) throw socialError("找不到通知", 404);
    if (row.type === "diary_reaction") {
      const diary = await Diary.findById(row.targetId)
        .select("user visibility")
        .lean();
      if (!diary || !canViewDiary(req.user, diary))
        throw socialError("這篇記憶已移除或不再向你分享", 404);
    } else if (!(await User.exists({ _id: row.actor })))
      throw socialError("這位使用者已不存在", 404);
    res.json({
      success: true,
      data: { type: row.type, targetId: row.targetId, actorId: row.actor },
    });
  } catch (error) {
    next(error);
  }
});
export default router;
