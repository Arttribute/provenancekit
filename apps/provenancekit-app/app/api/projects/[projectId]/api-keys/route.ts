import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  apiKeys,
  projects,
  organizationMembers,
} from "@/lib/db/schema";
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify user has access to this project's org
  const [project] = await db
    .select({ orgId: projects.orgId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      permissions: apiKeys.permissions,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.projectId, projectId));

  return NextResponse.json(keys);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Verify access
  const [project] = await db
    .select({ orgId: projects.orgId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  const { name, permissions, expiresInDays } = parsed.data;
  const { key, keyHash, prefix } = generateApiKey();

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [created] = await db
    .insert(apiKeys)
    .values({
      projectId,
      name,
      keyHash,
      prefix,
      permissions,
      expiresAt,
    })
    .returning({ id: apiKeys.id });

  // Return the plaintext key ONCE — never stored
  return NextResponse.json(
    { id: created.id, key, prefix, name, permissions },
    { status: 201 }
  );
}
