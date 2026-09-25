import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[db] Connected to MongoDB Atlas');
  } catch (error) {
    console.error('[db] MongoDB connection error:', error);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected — attempting reconnect...');
  });
}
