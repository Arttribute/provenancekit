import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { connectDB, UserModel } from "@/lib/db";

export async function POST(req: NextRequest): Promise<NextResponse> {
  await connectDB();
  const body = await req.json() as { privyDid?: string; email?: string; name?: string; avatar?: string };
  const { privyDid, email, name, avatar } = body;

  if (!privyDid) return NextResponse.json({ error: "privyDid required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user: any = await UserModel.findOneAndUpdate(
    { privyDid },
    { $set: { email, name, avatar }, $setOnInsert: { _id: uuidv4(), privyDid } },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json({ user });
}
