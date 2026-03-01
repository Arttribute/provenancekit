import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { organizations, organizationMembers } from "@/lib/db/schema";

const PatchOrgSchema = z.object({
  name: z.string().min(2).max(64).optional(),
});

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
    .select()
    .from(organizations)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.orgId, organizations.id),
        eq(organizationMembers.userId, session.user.id)
      )
    )
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(org);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
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

  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [updated] = await db
    .update(organizations)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(organizations.id, org.id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [org] = await db
    .select({ id: organizations.id, ownerId: organizations.ownerId })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (org.ownerId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the owner can delete an organization" },
      { status: 403 }
    );
  }

  await db.delete(organizations).where(eq(organizations.id, org.id));
  return NextResponse.json({ success: true });
}
