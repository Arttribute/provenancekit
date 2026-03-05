import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { connectDb } from "@/lib/mongodb";
import { User } from "@/lib/db/collections";

const PatchProfileSchema = z.object({
  name: z.string().max(128).optional(),
  avatar: z.string().url().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PatchProfileSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  await connectDb();
  await User.findOneAndUpdate(
    { privyDid: user.privyDid },
    { ...parsed.data, updatedAt: new Date() },
    { upsert: true }
  );

  return NextResponse.json({ success: true });
}
