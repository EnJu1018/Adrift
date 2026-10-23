import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Notification from "../src/models/Notification.js";
import ModerationAction from "../src/models/ModerationAction.js";
import Diary from "../src/models/Diary.js";
import { connectDb } from "../src/config/db.js";

dotenv.config();
try {
  await connectDb();
  await Notification.init();
  await ModerationAction.init();
  await Diary.init();
  let inserted = 0;
  for await (const user of User.find({ "friendRequests.status": "pending" })
    .select("friendRequests friends")
    .lean()
    .cursor()) {
    const seen = new Set(user.friends.map(String));
    for (const invite of user.friendRequests) {
      if (
        invite.status !== "pending" ||
        seen.has(String(invite.from))
      )
        continue;
      seen.add(String(invite.from));
      if (!(await User.exists({ _id: invite.from }))) continue;
      const result = await Notification.updateOne(
        {
          recipient: user._id,
          actor: invite.from,
          type: "friend_request",
          targetId: invite._id,
        },
        {
          $setOnInsert: {
            readAt: null,
            createdAt: invite.createdAt || new Date(),
          },
        },
        { upsert: true },
      );
      inserted += result.upsertedCount;
    }
  }
  console.log(`Pending invitation notifications added: ${inserted}`);
} finally {
  await mongoose.disconnect();
}
