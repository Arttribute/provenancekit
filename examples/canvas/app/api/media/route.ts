/**
 * POST /api/media
 *
 * Handles media file uploads for Canvas posts.
 * Uploads to Pinata IPFS and optionally records provenance via PK.
 *
 * Accepts multipart/form-data:
 *   file      — The media file
 *   authorId  — Privy DID of the uploader
 *   licenseType   — optional, e.g. "CC-BY-4.0"
 *   aiTraining    — optional, "permitted" | "reserved" | "unspecified"
 *
 * Returns: { cid, url, mimeType, size, provenanceCid?, actionId? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getPlatformClient } from "@/lib/provenance";
import type { CanvasUser } from "@/types";

const PINATA_JWT = process.env.PINATA_JWT;
const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "ipfs.io";

async function uploadToPinata(
  file: File
): Promise<{ cid: string; url: string }> {
  if (!PINATA_JWT) throw new Error("PINATA_JWT not configured");

  const formData = new FormData();
  formData.append("file", file);
  formData.append(
    "pinataMetadata",
    JSON.stringify({ name: `canvas-media-${Date.now()}` })
  );
  formData.append(
    "pinataOptions",
    JSON.stringify({ cidVersion: 1 })
  );

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata upload failed: ${text}`);
  }

  const data = await res.json() as { IpfsHash: string };
  const cid = data.IpfsHash;
  const url = `https://${IPFS_GATEWAY}/ipfs/${cid}`;
  return { cid, url };
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const authorId = formData.get("authorId") as string | null;
  const licenseType = (formData.get("licenseType") as string) ?? "CC-BY-4.0";
  const aiTraining = ((formData.get("aiTraining") as string) ?? "unspecified") as
    | "permitted"
    | "reserved"
    | "unspecified";

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!authorId) {
    return NextResponse.json({ error: "authorId is required" }, { status: 400 });
  }

  // Upload to Pinata
  let cid: string;
  let url: string;
  try {
    const result = await uploadToPinata(file);
    cid = result.cid;
    url = result.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Optionally record provenance for the media file (non-blocking)
  let provenanceCid: string | undefined;
  let actionId: string | undefined;

  const pk = getPlatformClient();
  if (pk) {
    try {
      const db = await getDb();
      const author = await db
        .collection<CanvasUser>("users")
        .findOne({ privyDid: authorId });

      const displayName =
        author?.displayName || author?.username || authorId.slice(0, 8);

      const mediaBlob = new Blob([await file.arrayBuffer()], {
        type: file.type,
      });

      const result = await pk.recordMediaUpload({
        authorPrivyDid: authorId,
        authorDisplayName: displayName,
        mediaBlob,
        mimeType: file.type,
        licenseType,
        aiTraining,
      });
      provenanceCid = result.cid;
      actionId = result.actionId;
    } catch (err) {
      console.warn("[Canvas PK] Media provenance recording failed:", err);
    }
  }

  return NextResponse.json({
    cid,
    url,
    mimeType: file.type,
    size: file.size,
    provenanceCid,
    actionId,
  });
}
