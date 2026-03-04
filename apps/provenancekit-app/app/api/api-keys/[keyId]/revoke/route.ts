import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { apiKeys, projects, organizationMembers } from "@/lib/db/schema";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const { keyId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the key + verify access through org membership
  const [key] = await db
    .select({
      id: apiKeys.id,
      projectId: apiKeys.projectId,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .limit(1);

  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (key.revokedAt)
    return NextResponse.json({ error: "Already revoked" }, { status: 409 });

  const [project] = await db
    .select({ orgId: projects.orgId })
    .from(projects)
    .where(eq(projects.id, key.projectId))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, project.orgId),
        eq(organizationMembers.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member || member.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId));

  return NextResponse.json({ success: true });
}
