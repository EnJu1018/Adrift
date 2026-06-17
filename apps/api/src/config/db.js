import mongoose from 'mongoose';

export async function connectDb() {
  const uri = resolveMongoUri();

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  });
  console.log(`MongoDB connected: ${maskMongoUri(uri)}`);
}

export function getDbStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    readyState: mongoose.connection.readyState,
    status: states[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host || '',
    name: mongoose.connection.name || ''
  };
}

function resolveMongoUri() {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  const legacyMongoUri = process.env.MONGO_URI?.trim();

  if (mongodbUri && legacyMongoUri && mongodbUri !== legacyMongoUri) {
    console.warn('Both MONGODB_URI and MONGO_URI are set. Using MONGODB_URI.');
  }

  const uri = mongodbUri || legacyMongoUri;

  if (uri) return uri;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is required in production. Set MONGODB_URI or MONGO_URI in the backend environment.');
  }

  return 'mongodb://127.0.0.1:27017/adrift';
}

function maskMongoUri(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = '***';
    return parsed.toString();
  } catch {
    return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//***:***@');
  }
}
