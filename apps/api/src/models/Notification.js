import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["friend_request", "friend_accepted", "diary_reaction"],
      required: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);
schema.index({ recipient: 1, createdAt: -1, _id: -1 });
schema.index({ recipient: 1, readAt: 1 });
schema.index(
  { recipient: 1, actor: 1, type: 1, targetId: 1 },
  { unique: true },
);
export default mongoose.model("Notification", schema);
