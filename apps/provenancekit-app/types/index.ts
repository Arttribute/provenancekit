import type { OrgRole } from "@/lib/permissions";

export type { OrgRole };

export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  badge?: string;
}

export interface OrgWithRole {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: OrgRole;
}

export interface ProjectWithOrg {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  orgId: string;
  orgSlug: string;
  storageType: string | null;
  chainId: number | null;
}

export interface ApiKeyDisplay {
  id: string;
  name: string;
  prefix: string;
  permissions: string;
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface UsageSummary {
  totalCalls: number;
  successRate: number;
  period: "day" | "week" | "month";
}
