import mongoose from "mongoose";

export function cursorQuery(value) {
  if (!value) return {};
  const [date, id] = String(value).split("|");
  const createdAt = new Date(date);
  if (
    !Number.isFinite(createdAt.getTime()) ||
    !/^[a-f\d]{24}$/i.test(id || "")
  ) {
    throw Object.assign(new Error("分頁位置不正確，請重新整理"), {
      statusCode: 400,
    });
  }
  return {
    $or: [
      { createdAt: { $lt: createdAt } },
      { createdAt, _id: { $lt: new mongoose.Types.ObjectId(id) } },
    ],
  };
}
export function pageCursor(items, limit) {
  const last = items[Math.min(items.length, limit) - 1];
  return items.length > limit && last
    ? `${new Date(last.createdAt).toISOString()}|${last._id}`
    : null;
}
