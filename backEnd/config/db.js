const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
  if (!mongoUri) {
    throw new Error('MONGODB_URI (or legacy MONGO_URI) is required in backEnd/.env.');
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DB_NAME || 'SmartAttendanceDB',
      maxPoolSize: Number.parseInt(process.env.MONGODB_MAX_POOL_SIZE, 10) || 20,
      minPoolSize: Number.parseInt(process.env.MONGODB_MIN_POOL_SIZE, 10) || 0,
      maxIdleTimeMS: Number.parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS, 10) || 60000,
    });
    console.log('MongoDB Connected Successfully');
    return conn;
  } catch {
    console.error('MongoDB connection failed. Verify the URI, database credentials, and network access settings.');
    throw new Error('MongoDB connection failed.');
  }
};

module.exports = connectDB;
