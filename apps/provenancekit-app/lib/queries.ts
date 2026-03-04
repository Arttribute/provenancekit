/**
 * Server-side data fetching helpers (Drizzle queries).
 * Used in RSC layouts/pages only — never imported client-side.
 */
import { eq, and, desc, count, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  organizations,
  organizationMembers,
  projects,
  apiKeys,
  usageRecords,
} from "@/lib/db/schema";
import type { OrgWithRole, ProjectWithOrg } from "@/types";

/** Get all orgs where a user is a member, with their role. */
export async function getUserOrgs(userId: string): Promise<OrgWithRole[]> {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      plan: organizations.plan,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.orgId, organizations.id))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(organizations.name);

  return rows as OrgWithRole[];
}

/** Get a single org by slug (with membership check). */
export async function getOrgBySlug(slug: string, userId: string) {
  const [row] = await db
    .select({
      org: organizations,
      role: organizationMembers.role,
    })
    .from(organizations)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.orgId, organizations.id),
        eq(organizationMembers.userId, userId)
      )
    )
    .where(eq(organizations.slug, slug))
    .limit(1);

  return row ?? null;
}

/** Get all projects in an org. */
export async function getOrgProjects(orgId: string): Promise<ProjectWithOrg[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      orgId: projects.orgId,
      orgSlug: organizations.slug,
      storageType: projects.storageType,
      chainId: projects.chainId,
    })
    .from(projects)
    .innerJoin(organizations, eq(projects.orgId, organizations.id))
    .where(eq(projects.orgId, orgId))
    .orderBy(projects.name);

  return rows as ProjectWithOrg[];
}

/** Get a single project by slug within an org. */
export async function getProjectBySlug(orgId: string, slug: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.slug, slug)))
    .limit(1);
  return row ?? null;
}

/** Get non-revoked API keys for a project. */
export async function getProjectApiKeys(projectId: string) {
  return db
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
    .where(eq(apiKeys.projectId, projectId))
    .orderBy(desc(apiKeys.createdAt));
}

/** Usage summary for a project (last 30 days). */
export async function getProjectUsageSummary(projectId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [total] = await db
    .select({ count: count() })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.projectId, projectId),
        gte(usageRecords.timestamp, thirtyDaysAgo)
      )
    );

  const [successes] = await db
    .select({ count: count() })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.projectId, projectId),
        gte(usageRecords.timestamp, thirtyDaysAgo),
        sql`${usageRecords.statusCode} >= 200 AND ${usageRecords.statusCode} < 300`
      )
    );

  const totalCount = total?.count ?? 0;
  const successCount = successes?.count ?? 0;

  return {
    totalCalls: totalCount,
    successRate: totalCount > 0 ? (successCount / totalCount) * 100 : 0,
    period: "month" as const,
  };
}

/** Org member list. */
export async function getOrgMembers(orgId: string) {
  return db
    .select({
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, orgId));
}
