import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();
  await db.collection("posts").updateOne({ _id: id }, { $inc: { likesCount: 1 } });
  return NextResponse.json({ success: true });
}
