import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: String,
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, expires: 0 }
}, { versionKey: false });

export default mongoose.model('AiUsage', schema);
