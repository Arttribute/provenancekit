import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { connectDB, UserModel } from "@/lib/db";
import { registerHumanEntity } from "@/lib/provenance";

export async function POST(req: NextRequest): Promise<NextResponse> {
  await connectDB();
  const body = await req.json() as { privyDid?: string; email?: string; name?: string; avatar?: string };
  const { privyDid, email, name, avatar } = body;

  if (!privyDid) return NextResponse.json({ error: "privyDid required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = await UserModel.findOneAndUpdate(
    { privyDid },
    { $set: { email, name, avatar }, $setOnInsert: { _id: uuidv4(), privyDid } },
    { upsert: true, new: true }
  ).lean();

  // Register the user as a ProvenanceKit entity on first login, or if pkEntityId
  // was never persisted (handles users who pre-date this change — fills in on next login).
  // Once stored, pkEntityId is stable forever — no PK API call on subsequent logins.
  if (!user.pkEntityId) {
    try {
      const pkEntityId = await registerHumanEntity(privyDid);
      if (pkEntityId) {
        await UserModel.updateOne({ _id: user._id }, { $set: { pkEntityId } });
        user = { ...user, pkEntityId };
      }
    } catch (err) {
      // Non-fatal: a PK outage must never block login.
      console.warn("[PK] Entity registration failed, continuing login:", err);
    }
  }

  return NextResponse.json({ user });
}
