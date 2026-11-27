const mongoose = require("mongoose");

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) return cached.conn;
  if (!process.env.MONGODB_URI) {
    const error = new Error("Account services are not configured yet.");
    error.code = "DATABASE_NOT_CONFIGURED";
    throw error;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 5,
      bufferCommands: false
    }).then((instance) => instance).catch((error) => {
      cached.promise = null;
      throw error;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectToDatabase;
