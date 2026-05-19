import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

dotenv.config();

const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase().trim();
const mongoUri = process.env.MONGODB_URI?.trim() || process.env.MONGO_URI?.trim();

if (!ownerEmail) {
  console.error('OWNER_EMAIL is required in ..env');
  process.exit(1);
}

if (!mongoUri) {
  console.error('MONGODB_URI is required in .env. MONGO_URI is also supported for legacy deployments.');
  process.exit(1);
}

try {
  await mongoose.connect(mongoUri);

  const user = await User.findOneAndUpdate(
    { email: ownerEmail },
    { role: 'owner' },
    { new: true, runValidators: true }
  ).select('_id name email userCode role');

  if (!user) {
    console.error(`Owner seed failed: no user found for ${ownerEmail}`);
    process.exitCode = 1;
  } else {
    console.log(`Owner seed complete: ${user.email} (${user.userCode}) is now ${user.role}`);
  }
} catch (error) {
  console.error('Owner seed failed:', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
