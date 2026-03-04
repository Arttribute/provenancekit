import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { connectDb } from "@/lib/mongodb";
import { Project, OrgMember, ApiKey } from "@/lib/db/collections";
import { generateApiKey } from "@/lib/api-keys";

const CreateKeySchema = z.object({
  name: z.string().min(1).max(64),
  permissions: z.enum(["read", "write", "admin"]).default("read"),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDb();
  const project = await Project.findById(projectId).lean();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await OrgMember.findOne({
    orgId: project.orgId,
    userId: user.privyDid,
  }).lean();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const keys = await ApiKey.find({ projectId })
    .sort({ createdAt: -1 })
    .select("-keyHash")
    .lean();

  return NextResponse.json(keys);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateKeySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  await connectDb();
  const project = await Project.findById(projectId).lean();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await OrgMember.findOne({
    orgId: project.orgId,
    userId: user.privyDid,
  }).lean();
  if (!member || member.role === "viewer")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, permissions, expiresInDays } = parsed.data;
  const { key, keyHash, prefix } = generateApiKey();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const created = await ApiKey.create({
    projectId,
    name,
    keyHash,
    prefix,
    permissions,
    expiresAt,
  });

  // Return the plaintext key ONCE — never stored
  return NextResponse.json(
    { id: String(created._id), key, prefix, name, permissions },
    { status: 201 }
  );
}
