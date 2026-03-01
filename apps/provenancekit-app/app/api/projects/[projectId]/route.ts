import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { projects, organizationMembers } from "@/lib/db/schema";

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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const [project] = await db
    .select({ orgId: projects.orgId })
    .from(projects)
    .where(eq(projects.id, projectId))
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

  const [updated] = await db
    .update(projects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [project] = await db
    .select({ orgId: projects.orgId })
    .from(projects)
    .where(eq(projects.id, projectId))
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
  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(projects).where(eq(projects.id, projectId));
  return NextResponse.json({ success: true });
}
