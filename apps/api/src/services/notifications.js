import Notification from "../models/Notification.js";

export function createNotification(recipient, actor, type, targetId, session) {
  if (String(recipient) === String(actor)) return;
  // A reaction toggle never revives a read notification or generates another alert.
  return Notification.updateOne(
    { recipient, actor, type, targetId },
    {
      $setOnInsert: { readAt: null },
    },
    { upsert: true, session },
  );
}
