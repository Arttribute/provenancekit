/**
 * Typed client for the ProvenanceKit management API.
 *
 * All methods are server-side only — they attach the MANAGEMENT_API_KEY and
 * X-User-Id headers. The user ID is read from the verified session cookie, so
 * no client-supplied data is ever trusted without Privy verification first.
 *
 * Usage (in a Server Component, layout, or API route):
 *   import { mgmt } from "@/lib/management-client";
 *   import { getServerUser } from "@/lib/auth";
 *
 *   const user = await getServerUser();
 *   if (!user) redirect("/login");
 *   const orgs = await mgmt(user.privyDid).orgs.list();
 */

const API_URL = process.env.PROVENANCEKIT_API_URL ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// Types (mirrors management handler response shapes)
// ---------------------------------------------------------------------------

export interface MgmtUser {
  id: string;
  privyDid: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  wallet: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MgmtOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  ownerId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface MgmtOrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  joinedAt: string;
}

export interface MgmtProject {
  id: string;
  orgId: string;
  orgSlug: string;
  name: string;
  slug: string;
  description: string | null;
  storageType: string | null;
  storageUrl: string | null;
  ipfsProvider: string | null;
  ipfsApiKey: string | null;
  ipfsGateway: string | null;
  chainId: number | null;
  contractAddress: string | null;
  rpcUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MgmtApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface MgmtCreatedApiKey {
  id: string;
  key: string;    // plaintext — shown once, never stored
  prefix: string;
  name: string;
  permissions: string;
}

export interface MgmtUsageSummary {
  summary: { totalCalls: number; successRate: number; period: "month" };
  byDay: Array<{ date: string; total: number; success: number }>;
}

export type MgmtValidateKeyResult =
  | { valid: true; projectId: string; orgId: string | null; userId: string | null; permissions: string }
  | { valid: false; reason: string };

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function managementKey(): string {
  const key = process.env.MANAGEMENT_API_KEY;
  if (!key) throw new Error("MANAGEMENT_API_KEY is not configured");
  return key;
}

function managementHeaders(userId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${managementKey()}`,
    "X-User-Id": userId,
  };
}

function systemHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${managementKey()}`,
  };
}

async function apiFetch<T>(
  method: string,
  path: string,
  userId: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}/management${path}`, {
    method,
    headers: managementHeaders(userId),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = typeof err.error === "string" ? err.error : JSON.stringify(err.error);
    throw new Error(`Management API error ${res.status}: ${message}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Validate a pk_live_ API key without a user context.
 * Used by the MCP server to authenticate admin key requests.
 */
export async function validateApiKey(key: string): Promise<MgmtValidateKeyResult> {
  const res = await fetch(`${API_URL}/management/auth/validate-key`, {
    method: "POST",
    headers: systemHeaders(),
    body: JSON.stringify({ key }),
    cache: "no-store",
  });
  return res.json() as Promise<MgmtValidateKeyResult>;
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create a management API client bound to a specific user.
 *
 * @param userId - The authenticated user's identifier (e.g. Privy DID).
 *                 Must come from a verified server-side session, never from client input.
 */
export function mgmt(userId: string) {
  const get  = <T>(path: string) => apiFetch<T>("GET",    path, userId);
  const post = <T>(path: string, body: unknown) => apiFetch<T>("POST",   path, userId, body);
  const put  = <T>(path: string, body: unknown) => apiFetch<T>("PUT",    path, userId, body);
  const del  = <T>(path: string) => apiFetch<T>("DELETE", path, userId);

  return {
    // ── Users ──────────────────────────────────────────────────────────────
    users: {
      me: () => get<MgmtUser>("/users/me"),
      upsert: (data: Partial<Pick<MgmtUser, "email" | "name" | "avatar" | "wallet">>) =>
        put<MgmtUser>("/users/me", data),
    },

    // ── Orgs ───────────────────────────────────────────────────────────────
    orgs: {
      list: () => get<MgmtOrg[]>("/orgs"),
      create: (data: { name: string; slug: string }) => post<MgmtOrg>("/orgs", data),
      get: (slug: string) => get<MgmtOrg>(`/orgs/${slug}`),
      update: (slug: string, data: { name?: string }) => put<MgmtOrg>(`/orgs/${slug}`, data),
      delete: (slug: string) => del<{ deleted: boolean }>(`/orgs/${slug}`),
    },

    // ── Members ────────────────────────────────────────────────────────────
    members: {
      list: (orgSlug: string) => get<MgmtOrgMember[]>(`/orgs/${orgSlug}/members`),
      add: (orgSlug: string, data: { userId: string; role?: string }) =>
        post<MgmtOrgMember>(`/orgs/${orgSlug}/members`, data),
      remove: (orgSlug: string, uid: string) =>
        del<{ deleted: boolean }>(`/orgs/${orgSlug}/members/${uid}`),
    },

    // ── Projects ───────────────────────────────────────────────────────────
    projects: {
      list: (orgSlug: string) => get<MgmtProject[]>(`/orgs/${orgSlug}/projects`),
      create: (
        orgSlug: string,
        data: {
          name: string;
          slug: string;
          description?: string | null;
          storageType?: string;
          storageUrl?: string | null;
          ipfsProvider?: string | null;
          ipfsApiKey?: string | null;
          ipfsGateway?: string | null;
          chainId?: number | null;
          contractAddress?: string | null;
          rpcUrl?: string | null;
        }
      ) => post<MgmtProject>(`/orgs/${orgSlug}/projects`, data),
      get: (projectId: string) => get<MgmtProject>(`/projects/${projectId}`),
      update: (projectId: string, data: Record<string, unknown>) =>
        put<MgmtProject>(`/projects/${projectId}`, data),
      delete: (projectId: string) => del<{ deleted: boolean }>(`/projects/${projectId}`),
    },

    // ── API Keys ───────────────────────────────────────────────────────────
    apiKeys: {
      list: (projectId: string) => get<MgmtApiKey[]>(`/projects/${projectId}/api-keys`),
      create: (
        projectId: string,
        data: { name: string; permissions?: string; expiresInDays?: number | null }
      ) => post<MgmtCreatedApiKey>(`/projects/${projectId}/api-keys`, data),
      revoke: (keyId: string) => del<{ revoked: boolean }>(`/api-keys/${keyId}`),
    },

    // ── Usage ──────────────────────────────────────────────────────────────
    usage: {
      get: (projectId: string) => get<MgmtUsageSummary>(`/projects/${projectId}/usage`),
    },
  };
}
