import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { connectDb } from "@/lib/mongodb";
import { Organization, OrgMember, Project } from "@/lib/db/collections";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  description: z.string().max(256).optional().nullable(),
  storageType: z.enum(["memory", "mongodb", "supabase"]).default("memory"),
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
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await Project.find({ orgId: String(org._id) }).lean();
  return NextResponse.json(rows);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  await connectDb();
  const org = await Organization.findOne({ slug: orgSlug }).lean();
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await OrgMember.findOne({
    orgId: String(org._id),
    userId: user.privyDid,
  }).lean();
  if (!member || member.role === "viewer")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, slug, description, storageType } = parsed.data;
  const project = await Project.create({
    orgId: String(org._id),
    name,
    slug,
    description,
    storageType,
  });

  return NextResponse.json(project, { status: 201 });
}
