/**
 * Server-side data fetching helpers (Mongoose queries).
 * Used in RSC layouts/pages only — never imported client-side.
 */
import { connectDb } from "@/lib/mongodb";
import {
  User,
  Organization,
  OrgMember,
  Project,
  ApiKey,
  UsageRecord,
} from "@/lib/db/collections";
import type { OrgWithRole, ProjectWithOrg } from "@/types";

/** Get all orgs where a user is a member, with their role. */
export async function getUserOrgs(privyDid: string): Promise<OrgWithRole[]> {
  await connectDb();

  const memberships = await OrgMember.find({ userId: privyDid }).lean();
  if (memberships.length === 0) return [];

  const orgIds = memberships.map((m) => String(m.orgId));
  const orgs = await Organization.find({ _id: { $in: orgIds } })
    .sort({ name: 1 })
    .lean();

  return orgs.map((org) => {
    const membership = memberships.find((m) => String(m.orgId) === String(org._id));
    return {
      id: String(org._id),
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      role: membership?.role ?? "viewer",
    };
  });
}

/** Get a single org by slug (with membership check). */
export async function getOrgBySlug(slug: string, privyDid: string) {
  await connectDb();

  const org = await Organization.findOne({ slug }).lean();
  if (!org) return null;

  const member = await OrgMember.findOne({
    orgId: String(org._id),
    userId: privyDid,
  }).lean();
  if (!member) return null;

  return { org, role: member.role };
}

/** Get all projects in an org. */
export async function getOrgProjects(orgId: string): Promise<ProjectWithOrg[]> {
  await connectDb();

  const [org, projectList] = await Promise.all([
    Organization.findById(orgId).lean(),
    Project.find({ orgId }).sort({ name: 1 }).lean(),
  ]);

  return projectList.map((p) => ({
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    description: p.description,
    orgId: p.orgId,
    orgSlug: org?.slug ?? "",
    storageType: p.storageType,
    chainId: p.chainId,
  }));
}

/** Get a single project by slug within an org. */
export async function getProjectBySlug(orgId: string, slug: string) {
  await connectDb();
  return Project.findOne({ orgId, slug }).lean();
}

/** Get a project by its _id string. */
export async function getProjectById(projectId: string) {
  await connectDb();
  return Project.findById(projectId).lean();
}

/** Get non-revoked API keys for a project. */
export async function getProjectApiKeys(projectId: string) {
  await connectDb();
  return ApiKey.find({ projectId })
    .sort({ createdAt: -1 })
    .select("_id name prefix permissions createdAt expiresAt lastUsedAt revokedAt")
    .lean();
}

/** Usage summary for a project (last 30 days). */
export async function getProjectUsageSummary(projectId: string) {
  await connectDb();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalCalls, successCount] = await Promise.all([
    UsageRecord.countDocuments({
      projectId,
      timestamp: { $gte: thirtyDaysAgo },
    }),
    UsageRecord.countDocuments({
      projectId,
      timestamp: { $gte: thirtyDaysAgo },
      statusCode: { $gte: 200, $lt: 300 },
    }),
  ]);

  return {
    totalCalls,
    successRate: totalCalls > 0 ? (successCount / totalCalls) * 100 : 0,
    period: "month" as const,
  };
}

/** Usage records grouped by day for the analytics chart (last 30 days). */
export async function getProjectUsageByDay(projectId: string) {
  await connectDb();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await UsageRecord.aggregate([
    { $match: { projectId, timestamp: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
        total: { $sum: 1 },
        success: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$statusCode", 200] },
                  { $lt: ["$statusCode", 300] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({
    date: r._id as string,
    total: r.total as number,
    success: r.success as number,
  }));
}

/** Org member list. */
export async function getOrgMembers(orgId: string) {
  await connectDb();
  return OrgMember.find({ orgId }).lean();
}

/** Check if a user is a member of an org and return their role. */
export async function getOrgMembership(
  orgId: string,
  privyDid: string
): Promise<string | null> {
  await connectDb();
  const member = await OrgMember.findOne({ orgId, userId: privyDid }).lean();
  return member?.role ?? null;
}

/** Get a user document by privyDid. */
export async function getUserByPrivyDid(privyDid: string) {
  await connectDb();
  return User.findOne({ privyDid }).lean();
}
