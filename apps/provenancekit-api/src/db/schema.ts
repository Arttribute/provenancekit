/**
 * Drizzle ORM schema for provenancekit-api.
 *
 * This is the single source of truth for ALL database tables.
 * The app (provenancekit-app) is a thin UI that calls the management API —
 * it does not connect to the database directly.
 *
 * Table namespaces:
 *   pk_api_* — API platform tables (entity flags, moderation)
 *   app_*    — Control plane tables (users, orgs, projects, API keys, usage)
 *
 * Run `pnpm db:push` to sync schema to Supabase (uses DATABASE_URL).
 * Run `pnpm db:generate` to generate a SQL migration file instead.
 */

import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  unique,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/*─────────────────────────────────────────────────────────────*\
 | pk_api_* — API platform tables                               |
\*─────────────────────────────────────────────────────────────*/

/**
 * Entity moderation flags (suspensions, bans, warnings).
 * Platform admins write to this table via the admin API.
 * The activity service reads it before accepting new activities.
 */
export const pkApiEntityFlags = pgTable("pk_api_entity_flags", {
  id:        uuid("id").defaultRandom().primaryKey(),
  entityId:  text("entity_id").notNull().unique(),
  flag:      text("flag").notNull(),   // "suspended" | "banned" | "flagged"
  reason:    text("reason"),
  flaggedBy: text("flagged_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export type EntityFlag       = InferSelectModel<typeof pkApiEntityFlags>;
export type InsertEntityFlag = InferInsertModel<typeof pkApiEntityFlags>;

/*─────────────────────────────────────────────────────────────*\
 | app_* — Control plane tables (single source of truth)        |
 |                                                              |
 | Owned exclusively by this API. The dashboard app is a thin   |
 | UI client that reads/writes these via /management/* endpoints.|
\*─────────────────────────────────────────────────────────────*/

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * Dashboard users — provisioned on first login via Privy.
 * privyDid is the stable identifier used across the system.
 */
export const appUsers = pgTable("app_users", {
  id:        uuid("id").defaultRandom().primaryKey(),
  privyDid:  text("privy_did").notNull().unique(),
  email:     text("email"),
  wallet:    text("wallet"),
  name:      text("name"),
  avatar:    text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppUser       = InferSelectModel<typeof appUsers>;
export type InsertAppUser = InferInsertModel<typeof appUsers>;

// ─── Organizations ────────────────────────────────────────────────────────────

/**
 * Organizations — top-level grouping for projects.
 * slug is globally unique and used in dashboard URLs.
 * plan: "free" | "pro" | "enterprise"
 */
export const appOrganizations = pgTable("app_organizations", {
  id:        uuid("id").defaultRandom().primaryKey(),
  name:      text("name").notNull(),
  slug:      text("slug").notNull().unique(),
  plan:      text("plan").default("free").notNull(),
  ownerId:   text("owner_id").notNull(),  // privyDid of creator
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppOrg       = InferSelectModel<typeof appOrganizations>;
export type InsertAppOrg = InferInsertModel<typeof appOrganizations>;

// ─── Organization Members ─────────────────────────────────────────────────────

/**
 * Org memberships — maps users (privyDid) to organizations.
 * role: "owner" | "admin" | "developer" | "viewer"
 *   owner     — full control, including delete org and billing
 *   admin     — manage members, projects, and API keys
 *   developer — create API keys; cannot manage members
 *   viewer    — read-only access to dashboard data
 */
export const appOrgMembers = pgTable("app_org_members", {
  id:       uuid("id").defaultRandom().primaryKey(),
  orgId:    uuid("org_id").notNull().references(() => appOrganizations.id, { onDelete: "cascade" }),
  userId:   text("user_id").notNull(),  // privyDid
  role:     text("role").default("developer").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (t) => [unique("uq_org_member").on(t.orgId, t.userId)]);

export type AppOrgMember       = InferSelectModel<typeof appOrgMembers>;
export type InsertAppOrgMember = InferInsertModel<typeof appOrgMembers>;

// ─── Projects ─────────────────────────────────────────────────────────────────

/**
 * Projects — each project has its own API keys, storage config, and chain config.
 * Projects live within an organization.
 * slug is unique within the org (composite unique constraint).
 */
export const appProjects = pgTable("app_projects", {
  id:              uuid("id").defaultRandom().primaryKey(),
  orgId:           uuid("org_id").notNull().references(() => appOrganizations.id, { onDelete: "cascade" }),
  name:            text("name").notNull(),
  slug:            text("slug").notNull(),
  description:     text("description"),

  // Advisory storage label — describes what DB adapter a self-hosted provenancekit-api
  // instance uses for EAA records. Has no effect on the hosted api.provenancekit.com.
  // Valid values: "memory" | "postgres" | "mongodb" | "supabase" | "ipfs" | "custom"
  storageType:     text("storage_type").default("supabase"),

  // Per-project IPFS / file storage config.
  // When ipfsApiKey is set, the ProvenanceKit API uses these credentials for file
  // uploads belonging to this project instead of the platform-level defaults.
  // This lets developers pin files to their own Pinata/IPFS/Arweave account.
  // Supported providers: "pinata" | "infura" | "web3storage" | "arweave" | "local"
  ipfsProvider:    text("ipfs_provider").default("pinata"),
  ipfsApiKey:      text("ipfs_api_key"),
  ipfsGateway:     text("ipfs_gateway"),

  // Self-hosted API URL. When set, the SDK should use this endpoint for
  // provenance operations instead of the hosted api.provenancekit.com.
  // Leave null/blank when using the hosted ProvenanceKit API.
  apiUrl:          text("api_url"),

  // On-chain config (for ProvenanceRegistry recording)
  chainId:         integer("chain_id"),
  contractAddress: text("contract_address"),
  rpcUrl:          text("rpc_url"),

  // Privacy settings
  // When true, every resource uploaded via this project's API key gets
  // ext:license@1.0.0 / hasAITrainingReservation: true attached automatically.
  aiTrainingOptOut: boolean("ai_training_opt_out").default(false),

  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
}, (t) => [unique("uq_project_slug").on(t.orgId, t.slug)]);

export type AppProject       = InferSelectModel<typeof appProjects>;
export type InsertAppProject = InferInsertModel<typeof appProjects>;

// ─── API Keys ─────────────────────────────────────────────────────────────────

/**
 * API keys — scoped to a project; used by developers to call the provenance API.
 *
 * Security model:
 *   keyHash  — SHA-256(plaintext_key); stored, used for constant-time comparison
 *   prefix   — "pk_live_XXXXXXXX" (first 16 chars); shown in the dashboard as identifier
 *   The plaintext key is returned ONCE on creation and never stored.
 *
 * permissions: "read" | "write" | "admin"
 */
export const appApiKeys = pgTable("app_api_keys", {
  id:          uuid("id").defaultRandom().primaryKey(),
  projectId:   uuid("project_id").notNull().references(() => appProjects.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  keyHash:     text("key_hash").notNull().unique(),
  prefix:      text("prefix").notNull(),
  permissions: text("permissions").default("read").notNull(),
  expiresAt:   timestamp("expires_at"),
  lastUsedAt:  timestamp("last_used_at"),
  revokedAt:   timestamp("revoked_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export type AppApiKey       = InferSelectModel<typeof appApiKeys>;
export type InsertAppApiKey = InferInsertModel<typeof appApiKeys>;

// ─── Usage Records ────────────────────────────────────────────────────────────

/**
 * Usage records — one row per authenticated API request.
 * Written fire-and-forget in the usage middleware.
 * Read by the management API for dashboard analytics.
 */
export const appUsageRecords = pgTable("app_usage_records", {
  id:           uuid("id").defaultRandom().primaryKey(),
  projectId:    uuid("project_id").notNull(),
  apiKeyId:     uuid("api_key_id"),
  endpoint:     text("endpoint").notNull(),
  resourceType: text("resource_type"),
  statusCode:   integer("status_code"),
  timestamp:    timestamp("timestamp").defaultNow().notNull(),
});

export type UsageRecord       = InferSelectModel<typeof appUsageRecords>;
export type InsertUsageRecord = InferInsertModel<typeof appUsageRecords>;

// ─── Provenance Shares ────────────────────────────────────────────────────────

/**
 * Provenance shares — cryptographically-backed shareable links.
 *
 * Uses @provenancekit/privacy selective disclosure (SD-JWT-like pattern):
 *   - At creation: ALL items are signed into a SelectiveDisclosureDocument.
 *     Each item becomes a claim keyed by "action:<id>", "resource:<ref>", "entity:<id>".
 *   - At read time: createPresentation() reveals only the non-redacted items.
 *   - Viewers always see document.digests (commits to ALL items), so they know
 *     the full structure and which items were redacted — nothing can be fabricated.
 *
 * sdDocument: SelectiveDisclosureDocument (public commitment, all item digests + HMAC sig)
 * sdDisclosures: EncodedDisclosure[] for ALL items (server holds, created once at share time)
 * sdSecret: hex-encoded HMAC secret (server holds for signature verification)
 *
 * redactedIds: string[] of item keys the author chose not to disclose
 * redactionReasons: Record<itemKey, { reason?, label? }> shown to viewers for each redacted item
 */
export const appProvenanceShares = pgTable("app_provenance_shares", {
  id:             uuid("id").defaultRandom().primaryKey(),
  projectId:      uuid("project_id"),
  title:          text("title"),
  description:    text("description"),
  cid:            text("cid"),
  sessionId:      text("session_id"),
  projectScopeId: text("project_scope_id"),

  // Selective disclosure backing (@provenancekit/privacy)
  sdDocument:       jsonb("sd_document"),    // SelectiveDisclosureDocument (public commitment)
  sdDisclosures:    jsonb("sd_disclosures"), // EncodedDisclosure[] — server holds all disclosures
  sdSecret:         text("sd_secret"),       // hex HMAC secret — server holds for verification

  // User-controlled redaction state
  redactedIds:      jsonb("redacted_ids").default([]).notNull(),       // string[] of item keys
  redactionReasons: jsonb("redaction_reasons").default({}).notNull(),  // Record<key, {reason?,label?}>

  viewCount:      integer("view_count").default(0).notNull(),
  expiresAt:      timestamp("expires_at"),
  revokedAt:      timestamp("revoked_at"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});

export type ProvenanceShare       = InferSelectModel<typeof appProvenanceShares>;
export type InsertProvenanceShare = InferInsertModel<typeof appProvenanceShares>;
