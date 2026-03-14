/**
 * POST /api/media/upload
 *
 * Accepts a multipart form with a `file` field (and optional `userId`).
 * Uploads to Pinata/IPFS and returns a persistent gateway URL + CID.
 * Falls back to base64 data URL if PINATA_JWT is not configured (local dev).
 *
 * NOTE: This route intentionally does NOT register the file in ProvenanceKit.
 * Provenance registration happens downstream via the FileProvenanceTag component:
 *   - If the file already has provenance (match ≥ 0.95): the matched CID is
 *     used directly as inputCid — no re-upload or new action needed.
 *   - If no prior provenance: FileOwnershipClaim asks the user, then calls
 *     /api/pk-proxy/claim to register a new "create" or "reference" action.
 * This two-step design ensures existing provenance chains are referenced rather
 * than duplicated, which is where the compound provenance value comes from.
 *
 * For text/* files, the text content is also returned so the LLM
 * can read the file contents inline.
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

async function uploadToPinata(
  file: File,
  pinataJwt: string
): Promise<{ cid: string; url: string } | null> {
  try {
    const ipfsGateway = (process.env.PK_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs").replace(/\/$/, "");
    const form = new FormData();
    form.append("file", file, file.name);

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: form,
    });

    if (!res.ok) return null;

    const data = await res.json();
    const cid: string = data.IpfsHash;
    return { cid, url: `${ipfsGateway}/${cid}` };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  // userId is accepted but not used here — it's forwarded by FileProvenanceTag
  // to /api/pk-proxy/claim when the user makes an ownership decision.

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

  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);

  // Extract text content for text/* files so the LLM can read them inline.
  let textContent: string | undefined;
  if (file.type.startsWith("text/")) {
    textContent = await file.text();
  }

  // Try to upload to Pinata/IPFS for a persistent URL (never store base64 in DB).
  const pinataJwt = process.env.PINATA_JWT;
  if (pinataJwt) {
    const pinata = await uploadToPinata(file, pinataJwt);
    if (pinata) {
      return NextResponse.json({
        url: pinata.url,
        cid: pinata.cid,
        mimeType: file.type,
        name: file.name,
        size: file.size,
        isImage,
        textContent,
      });
    }
  }

  // Fallback: base64 data URL (local dev without Pinata configured).
  // In production, PINATA_JWT must be set — base64 is too large for MongoDB.
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  return NextResponse.json({
    url: dataUrl,
    cid: undefined,
    mimeType: file.type,
    name: file.name,
    size: file.size,
    isImage,
    textContent,
  });
}
