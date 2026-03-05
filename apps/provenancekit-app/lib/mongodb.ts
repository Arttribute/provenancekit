import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/provenancekit-app";

declare global {
  var _pkMongoosePromise: Promise<typeof mongoose> | undefined;
}

/**
 * Returns the active Mongoose connection, creating it if needed.
 * Caches the Promise (not the resolved value) so concurrent calls
 * during startup all await the same connect() — required when
 * bufferCommands = false.
 */
export async function connectDb(): Promise<typeof mongoose> {
  // Already connected — fast path
  if (mongoose.connection.readyState === 1) return mongoose;

  // Cache the Promise globally so hot-reloads and concurrent requests
  // don't each start their own connect() call.
  if (!global._pkMongoosePromise) {
    global._pkMongoosePromise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  return global._pkMongoosePromise;
}
