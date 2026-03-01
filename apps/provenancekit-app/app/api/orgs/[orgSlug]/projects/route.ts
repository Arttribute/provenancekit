import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { organizations, organizationMembers, projects } from "@/lib/db/schema";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  description: z.string().max(256).optional().nullable(),
  storageType: z.enum(["memory", "postgres", "mongodb", "supabase"]).default("memory"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Get org
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check membership
  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member || member.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, slug, description, storageType } = parsed.data;

  const [project] = await db
    .insert(projects)
    .values({ orgId: org.id, name, slug, description, storageType })
    .returning();

  return NextResponse.json(project, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, org.id));

  return NextResponse.json(rows);
}
