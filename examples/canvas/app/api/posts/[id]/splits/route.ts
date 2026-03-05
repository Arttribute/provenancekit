/**
 * GET  /api/posts/[id]/splits  — Return splits contract recipients
 * POST /api/posts/[id]/splits  — Calculate distribution + store splits config
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getPlatformClient } from "@/lib/provenance";
import type { Post, SplitsContract } from "@/types";
import { v4 as uuidv4 } from "uuid";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asId = (id: string): any => id;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();

  const contract = await db
    .collection<SplitsContract>("splits_contracts")
    .findOne({ postId: id });

  if (!contract) {
    return NextResponse.json({ recipients: [] });
  }

  return NextResponse.json({
    recipients: contract.recipients,
    contractAddress: contract.contractAddress,
    chainId: contract.chainId,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { deployerId } = await req.json();

  if (!deployerId) {
    return NextResponse.json({ error: "deployerId is required" }, { status: 400 });
  }

  const db = await getDb();
  const post = await db.collection<Post>("posts").findOne({ _id: asId(id) });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (post.splitsContract) {
    return NextResponse.json(
      { error: "Splits contract already deployed", contract: post.splitsContract },
      { status: 409 }
    );
  }

  if (!post.provenanceCid) {
    return NextResponse.json(
      { error: "Post has no provenance record" },
      { status: 422 }
    );
  }

  if (post.authorId !== deployerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pk = getPlatformClient();
  if (!pk) {
    return NextResponse.json({ error: "ProvenanceKit not configured" }, { status: 503 });
  }

  const distribution = await pk.getDistribution(post.provenanceCid);
  if (!distribution.length) {
    return NextResponse.json({ error: "Could not compute distribution" }, { status: 422 });
  }

  const withWallets = distribution.filter((e) => !!e.wallet);

  // Placeholder — production: deploy via @provenancekit/payments SplitsAdapter
  const mockContractAddress = "0x" + Array.from(
    { length: 40 },
    () => Math.floor(Math.random() * 16).toString(16)
  ).join("");

  const splitsDoc: SplitsContract = {
    _id: uuidv4(),
    postId: id,
    contractAddress: mockContractAddress,
    chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532"),
    recipients: (withWallets.length ? withWallets : distribution).map((e) => ({
      entityId: e.entityId,
      wallet: e.wallet ?? "",
      share: e.bps,
    })),
    deployedAt: new Date(),
    deployedBy: deployerId,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.collection("splits_contracts").insertOne(splitsDoc as any);
  await db
    .collection("posts")
    .updateOne({ _id: asId(id) }, { $set: { splitsContract: mockContractAddress } });

  return NextResponse.json({
    success: true,
    contract: mockContractAddress,
    recipients: distribution,
  });
}
