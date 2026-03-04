import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { connectDb } from "@/lib/mongodb";
import { Project, OrgMember } from "@/lib/db/collections";

const PatchProjectSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(256).nullable().optional(),
  storageType: z.string().optional(),
  storageUrl: z.string().nullable().optional(),
  ipfsProvider: z.string().optional(),
  ipfsApiKey: z.string().nullable().optional(),
  ipfsGateway: z.string().nullable().optional(),
  chainId: z.coerce.number().int().positive().nullable().optional(),
  contractAddress: z.string().nullable().optional(),
  rpcUrl: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PatchProjectSchema.safeParse(body);
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

  const updated = await Project.findByIdAndUpdate(
    projectId,
    { ...parsed.data, updatedAt: new Date() },
    { new: true }
  ).lean();

  return NextResponse.json(updated);
}

export async function DELETE(
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
  if (!member || !["owner", "admin"].includes(member.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await Project.findByIdAndDelete(projectId);
  return NextResponse.json({ success: true });
}
