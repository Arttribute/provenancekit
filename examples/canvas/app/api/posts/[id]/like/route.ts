import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asId = (s: string): any => s;
  await db.collection("posts").updateOne({ _id: asId(id) }, { $inc: { likesCount: 1 } });
  return NextResponse.json({ success: true });
}
