/**
 * Server-side data fetching helpers.
 *
 * All data comes from the ProvenanceKit management API — the app has no
 * direct database connection. Every function requires a verified userId
 * from the server session (never from client-supplied input).
 */

import { mgmt, type MgmtOrg, type MgmtProject, type MgmtApiKey } from "@/lib/management-client";

// Re-export types for consumers that previously imported from here
export type { MgmtOrg as OrgWithRole, MgmtProject as ProjectWithOrg, MgmtApiKey as ApiKeyRow };

/** Get all orgs where a user is a member (with their role). */
export async function getUserOrgs(userId: string): Promise<MgmtOrg[]> {
  try {
    return await mgmt(userId).orgs.list();
  } catch {
    return [];
  }
}

/** Get a single org by slug (with membership check). Returns null if not found or not a member. */
export async function getOrgBySlug(slug: string, userId: string) {
  try {
    const org = await mgmt(userId).orgs.get(slug);
    return { org, role: org.role };
  } catch {
    return null;
  }
}

/** Get all projects in an org. */
export async function getOrgProjects(orgSlug: string, userId: string): Promise<MgmtProject[]> {
  try {
    return await mgmt(userId).projects.list(orgSlug);
  } catch {
    return [];
  }
}

/** Get a project by its id. */
export async function getProjectById(projectId: string, userId: string) {
  try {
    return await mgmt(userId).projects.get(projectId);
  } catch {
    return null;
  }
}

/** Get a project by slug within an org. */
export async function getProjectBySlug(orgSlug: string, slug: string, userId: string) {
  try {
    const projects = await mgmt(userId).projects.list(orgSlug);
    return projects.find((p) => p.slug === slug) ?? null;
  } catch {
    return null;
  }
}

/** Get API keys for a project (keyHash excluded). */
export async function getProjectApiKeys(projectId: string, userId: string): Promise<MgmtApiKey[]> {
  try {
    return await mgmt(userId).apiKeys.list(projectId);
  } catch {
    return [];
  }
}

/** Usage summary for a project (last 30 days). */
export async function getProjectUsageSummary(projectId: string, userId: string) {
  try {
    const data = await mgmt(userId).usage.get(projectId);
    return data.summary;
  } catch {
    return null;
  }
}

/** Usage records grouped by day for the analytics chart (last 30 days). */
export async function getProjectUsageByDay(projectId: string, userId: string) {
  try {
    const data = await mgmt(userId).usage.get(projectId);
    return data.byDay;
  } catch {
    return [];
  }
}

/** Org member list. */
export async function getOrgMembers(orgSlug: string, userId: string) {
  try {
    return await mgmt(userId).members.list(orgSlug);
  } catch {
    return [];
  }
}

/** Get the current user record. */
export async function getUserByUserId(userId: string) {
  try {
    return await mgmt(userId).users.me();
  } catch {
    return null;
  }
}
