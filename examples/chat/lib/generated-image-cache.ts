import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

type GeneratedImageEntry = {
  buffer: Buffer;
  contentType: string;
};

type StoredGridFile = {
  _id: mongoose.mongo.ObjectId;
  contentType?: string;
  metadata?: { expiresAt?: Date | string };
};

const BUCKET_NAME = "generated_images";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var _pkGeneratedImageLastPrune: number | undefined;
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB is not connected.");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
}

async function pruneExpiredImages(now = Date.now()) {
  if (global._pkGeneratedImageLastPrune && now - global._pkGeneratedImageLastPrune < PRUNE_INTERVAL_MS) {
    return;
  }
  global._pkGeneratedImageLastPrune = now;

  const bucket = getBucket();
  const expired = await bucket
    .find({ "metadata.expiresAt": { $lte: new Date(now) } })
    .limit(25)
    .toArray();

  await Promise.allSettled(expired.map((file) => bucket.delete(file._id)));
}

export async function putGeneratedImage(buffer: Buffer, contentType = "image/png", ttlMs = DEFAULT_TTL_MS) {
  await connectDB();
  await pruneExpiredImages();

  const id = randomUUID();
  const bucket = getBucket();
  const upload = bucket.openUploadStream(id, {
    contentType,
    metadata: { expiresAt: new Date(Date.now() + ttlMs) },
  });

  await new Promise<void>((resolve, reject) => {
    Readable.from(buffer).pipe(upload).on("error", reject).on("finish", resolve);
  });

  return {
    id,
    url: `/api/media/generated/${id}`,
  };
}

export async function getGeneratedImage(id: string): Promise<GeneratedImageEntry | null> {
  await connectDB();
  await pruneExpiredImages();

  const bucket = getBucket();
  const file = (await bucket.find({ filename: id }).limit(1).next()) as StoredGridFile | null;
  if (!file) return null;

  const expiresAt = file.metadata?.expiresAt ? new Date(file.metadata.expiresAt).getTime() : null;
  if (expiresAt && expiresAt <= Date.now()) {
    await bucket.delete(file._id).catch(() => undefined);
    return null;
  }

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    bucket
      .openDownloadStream(file._id)
      .on("data", (chunk) => chunks.push(Buffer.from(chunk)))
      .on("error", reject)
      .on("end", resolve);
  });

  return {
    buffer: Buffer.concat(chunks),
    contentType: file.contentType ?? "image/png",
  };
}

export { bufferToArrayBuffer };
