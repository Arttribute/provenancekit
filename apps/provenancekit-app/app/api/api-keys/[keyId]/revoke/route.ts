import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { connectDb } from "@/lib/mongodb";
import { ApiKey, Project, OrgMember } from "@/lib/db/collections";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const { keyId } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDb();
  const apiKey = await ApiKey.findById(keyId).lean();
  if (!apiKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (apiKey.revokedAt)
    return NextResponse.json({ error: "Already revoked" }, { status: 409 });

  const project = await Project.findById(apiKey.projectId).lean();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await OrgMember.findOne({
    orgId: project.orgId,
    userId: user.privyDid,
  }).lean();
  if (!member || member.role === "viewer")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ApiKey.findByIdAndUpdate(keyId, { revokedAt: new Date() });
  return NextResponse.json({ success: true });
}
