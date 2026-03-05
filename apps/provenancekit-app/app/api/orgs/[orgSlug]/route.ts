import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { connectDb } from "@/lib/mongodb";
import { Organization, OrgMember } from "@/lib/db/collections";

const PatchOrgSchema = z.object({
  name: z.string().min(2).max(64).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDb();
  const org = await Organization.findOne({ slug: orgSlug }).lean();
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await OrgMember.findOne({
    orgId: String(org._id),
    userId: user.privyDid,
  }).lean();
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...org, role: member.role });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PatchOrgSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  await connectDb();
  const org = await Organization.findOne({ slug: orgSlug }).lean();
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await OrgMember.findOne({
    orgId: String(org._id),
    userId: user.privyDid,
  }).lean();
  if (!member || !["owner", "admin"].includes(member.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await Organization.findByIdAndUpdate(
    org._id,
    { ...parsed.data, updatedAt: new Date() },
    { new: true }
  ).lean();

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDb();
  const org = await Organization.findOne({ slug: orgSlug }).lean();
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (org.ownerId !== user.privyDid)
    return NextResponse.json(
      { error: "Only the owner can delete an organization" },
      { status: 403 }
    );

  await Organization.findByIdAndDelete(org._id);
  return NextResponse.json({ success: true });
}
