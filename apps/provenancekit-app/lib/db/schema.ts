import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  primaryKey,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/*─────────────────────────────────────────────────────────────*\
 | NextAuth Tables                                              |
\*─────────────────────────────────────────────────────────────*/

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

/*─────────────────────────────────────────────────────────────*\
 | Multi-Tenancy: Organizations                                 |
\*─────────────────────────────────────────────────────────────*/

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("developer"), // owner | admin | developer | viewer
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })]
);

export const organizationInvites = pgTable("organization_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("developer"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/*─────────────────────────────────────────────────────────────*\
 | Projects (provenance namespaces)                             |
\*─────────────────────────────────────────────────────────────*/

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Storage config
  storageType: text("storage_type").default("memory"), // postgres | mongodb | supabase | memory
  storageUrl: text("storage_url"), // encrypted

  // IPFS config
  ipfsProvider: text("ipfs_provider").default("pinata"), // pinata | infura | web3storage | local
  ipfsApiKey: text("ipfs_api_key"), // encrypted
  ipfsGateway: text("ipfs_gateway"),

  // Blockchain config
  chainId: integer("chain_id"),
  contractAddress: text("contract_address"),
  rpcUrl: text("rpc_url"),

  // Internal API key for dashboard→API communication (server-side only)
  internalApiKey: text("internal_api_key"),
});

/*─────────────────────────────────────────────────────────────*\
 | API Keys                                                     |
\*─────────────────────────────────────────────────────────────*/

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(), // SHA-256 of actual key
  prefix: text("prefix").notNull(),   // first 8 chars shown in UI
  permissions: text("permissions").notNull().default("read"), // read | write | admin
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/*─────────────────────────────────────────────────────────────*\
 | Usage & Billing                                              |
\*─────────────────────────────────────────────────────────────*/

export const usageRecords = pgTable("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  apiKeyId: uuid("api_key_id"),
  endpoint: text("endpoint").notNull(),
  statusCode: integer("status_code"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const billingPlans = pgTable("billing_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  apiCallLimit: integer("api_call_limit"),
  teamMemberLimit: integer("team_member_limit"),
  storageGbLimit: integer("storage_gb_limit"),
  price: integer("price").notNull().default(0), // cents/month
});

export const orgSubscriptions = pgTable("org_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  planId: text("plan_id")
    .notNull()
    .references(() => billingPlans.id),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubId: text("stripe_sub_id"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/*─────────────────────────────────────────────────────────────*\
 | Audit Log                                                    |
\*─────────────────────────────────────────────────────────────*/

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  userId: text("user_id"),
  action: text("action").notNull(),
  resource: text("resource"),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

/*─────────────────────────────────────────────────────────────*\
 | Webhooks                                                     |
\*─────────────────────────────────────────────────────────────*/

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: jsonb("events").notNull().default("[]"),
  secret: text("secret"), // encrypted
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/*─────────────────────────────────────────────────────────────*\
 | Type Exports                                                 |
\*─────────────────────────────────────────────────────────────*/

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
