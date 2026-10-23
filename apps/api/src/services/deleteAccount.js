import User from "../models/User.js";
import Diary from "../models/Diary.js";
import Notification from "../models/Notification.js";
import { socialError } from "./friendRelationships.js";
import { removeUpload } from "../utils/removeUpload.js";

export async function deleteAccountData(id) {
  const media = await User.db.transaction(
    async (session) => {
      const user = await User.findById(id).session(session);
      if (!user) throw socialError("找不到使用者", 404);
      if (user.role === "owner")
        throw socialError("Owner 帳號受到保護，無法刪除", 403);
      const diaries = await Diary.find({ user: id })
        .select("imageUrl")
        .session(session)
        .lean();
      await Diary.deleteMany({ user: id }, { session });
      await Diary.updateMany(
        { "reactedUsers.userId": id },
        [
          {
            $set: {
              reactedUsers: {
                $filter: {
                  input: "$reactedUsers",
                  as: "reaction",
                  cond: { $ne: ["$$reaction.userId", user._id] },
                },
              },
            },
          },
          {
            $set: Object.fromEntries(
              ["understand", "hug", "relate"].map((type) => [
                `reactions.${type}`,
                {
                  $size: {
                    $filter: {
                      input: "$reactedUsers",
                      as: "reaction",
                      cond: { $eq: ["$$reaction.type", type] },
                    },
                  },
                },
              ]),
            ),
          },
        ],
        { session },
      );
      await User.updateMany(
        { $or: [{ friends: id }, { "friendRequests.from": id }] },
        { $pull: { friends: id, friendRequests: { from: id } } },
        { session },
      );
      await Notification.deleteMany(
        { $or: [{ recipient: id }, { actor: id }] },
        { session },
      );
      await User.deleteOne({ _id: id }, { session });
      return [user.avatar, ...diaries.map((diary) => diary.imageUrl)];
    },
    { maxCommitTimeMS: 5000, timeoutMS: 15000 },
  );
  for (const file of media) await removeUpload(file);
}
