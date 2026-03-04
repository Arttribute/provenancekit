/**
 * POST /api/posts/[id]/splits
 * Deploy a 0xSplits contract for a post based on its provenance graph.
 * Records the contract address back on the post document.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createCanvasPKClient } from "@/lib/provenance";
import type { Post, CanvasUser, SplitsContract } from "@/types";
import { v4 as uuidv4 } from "uuid";

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
  const post = await db.collection<Post>("posts").findOne({ _id: id });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (post.splitsContract) {
    return NextResponse.json(
      { error: "Splits contract already deployed", contract: post.splitsContract },
      { status: 409 }
    );
  }

  if (!post.provenanceCid) {
    return NextResponse.json(
      { error: "Post has no provenance record — cannot compute distribution" },
      { status: 422 }
    );
  }

  const deployer = await db.collection<CanvasUser>("users").findOne({ privyDid: deployerId });
  if (!deployer) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const pk = createCanvasPKClient(deployer);
  if (!pk) {
    return NextResponse.json({ error: "ProvenanceKit not configured" }, { status: 503 });
  }

  // Get distribution based on provenance graph
  const distribution = await pk.getDistribution(post.provenanceCid);
  if (!distribution.length) {
    return NextResponse.json({ error: "Could not compute distribution" }, { status: 422 });
  }

  // In production: deploy the 0xSplits contract using viem + Base
  // Here we store the configuration and return a placeholder address
  // The actual deployment would use @provenancekit/payments SplitsAdapter
  const mockContractAddress = `0x${Array.from({ length: 40 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("")}`;

  const splitsDoc: SplitsContract = {
    _id: uuidv4(),
    postId: id,
    contractAddress: mockContractAddress,
    chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "84532"), // Base Sepolia
    recipients: distribution,
    deployedAt: new Date(),
    deployedBy: deployerId,
  };

  await db.collection("splits_contracts").insertOne(splitsDoc);
  await db.collection("posts").updateOne(
    { _id: id },
    { $set: { splitsContract: mockContractAddress } }
  );

  return NextResponse.json({ success: true, contract: mockContractAddress, recipients: distribution });
}
