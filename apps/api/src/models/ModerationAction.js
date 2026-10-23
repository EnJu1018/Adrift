import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    action: { type: String, enum: ["delete_diary"], required: true },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 4,
      maxlength: 300,
    },
  },
  { timestamps: true },
);
schema.index({ createdAt: -1 });
export default mongoose.model("ModerationAction", schema);
