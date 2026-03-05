/**
 * POST /api/media/upload
 *
 * Accepts a multipart form with a `file` field.
 * Returns a base64 data URL so the browser can use it inline.
 * For images, this is passed as image_url content to GPT-4o vision.
 *
 * In production you'd upload to S3/Supabase and return the URL.
 * For this demo, base64 inline keeps it self-contained.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
  "text/plain",
  "text/markdown",
];

const MAX_SIZE_MB = 20;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 415 }
    );
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_SIZE_MB}MB)` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  return NextResponse.json({
    url: dataUrl,
    mimeType: file.type,
    name: file.name,
    size: file.size,
    isImage: ALLOWED_IMAGE_TYPES.includes(file.type),
  });
}
