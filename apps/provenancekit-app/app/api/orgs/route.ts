import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { connectDb } from "@/lib/mongodb";
import { Organization, OrgMember } from "@/lib/db/collections";

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(64),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, slug } = parsed.data;

  await connectDb();

  const existing = await Organization.findOne({ slug }).lean();
  if (existing) {
    return NextResponse.json(
      { error: "An organization with this slug already exists" },
      { status: 409 }
    );
  }

  const org = await Organization.create({ name, slug, ownerId: user.privyDid });

  await OrgMember.create({
    orgId: String(org._id),
    userId: user.privyDid,
    role: "owner",
  });

  return NextResponse.json(org, { status: 201 });
}
