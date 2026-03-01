import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { organizations, organizationMembers } from "@/lib/db/schema";
import { generateApiKey } from "@/lib/api-keys";

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(64),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
  userId: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, slug } = parsed.data;
  const userId = session.user.id;

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "An organization with this slug already exists" },
      { status: 409 }
    );
  }

  const [org] = await db
    .insert(organizations)
    .values({ name, slug, ownerId: userId })
    .returning();

  // Add creator as owner member
  await db.insert(organizationMembers).values({
    orgId: org.id,
    userId,
    role: "owner",
  });

  return NextResponse.json(org, { status: 201 });
}
