/**
 * Mongoose schemas + models for all app collections.
 * Collection names are prefixed with `app_` to co-exist with the
 * provenancekit-api's `pk_*` collections in the same MongoDB instance.
 *
 * Import models directly — connectDb() is called inside each server helper.
 */

import mongoose, { Schema, type Document, type Model } from "mongoose";

// ─── Helper: safe model registration (handles hot-reload in dev) ──────────────

function model<T extends Document>(
  name: string,
  schema: Schema,
  collection: string
): Model<T> {
  return (mongoose.models[name] as Model<T>) ?? mongoose.model<T>(name, schema, collection);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface IUser extends Document {
  privyDid: string;
  email?: string;
  wallet?: string;
  name?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    privyDid: { type: String, required: true, unique: true },
    email:    { type: String },
    wallet:   { type: String },
    name:     { type: String },
    avatar:   { type: String },
  },
  { timestamps: true, collection: "app_users" }
);

export const User = model<IUser>("AppUser", UserSchema, "app_users");

// ─── Organizations ────────────────────────────────────────────────────────────

export interface IOrganization extends Document {
  name: string;
  slug: string;
  plan: string;
  ownerId: string;   // privyDid
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name:    { type: String, required: true },
    slug:    { type: String, required: true, unique: true },
    plan:    { type: String, default: "free" },
    ownerId: { type: String, required: true, index: true },
  },
  { timestamps: true, collection: "app_organizations" }
);

export const Organization = model<IOrganization>(
  "AppOrganization",
  OrganizationSchema,
  "app_organizations"
);

// ─── Organization Members ─────────────────────────────────────────────────────

export interface IOrgMember extends Document {
  orgId: string;
  userId: string;    // privyDid
  role: string;      // "owner" | "admin" | "developer" | "viewer"
  joinedAt: Date;
}

const OrgMemberSchema = new Schema<IOrgMember>(
  {
    orgId:  { type: String, required: true },
    userId: { type: String, required: true },
    role:   { type: String, default: "developer" },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { collection: "app_org_members" }
);

OrgMemberSchema.index({ orgId: 1, userId: 1 }, { unique: true });
OrgMemberSchema.index({ userId: 1 });

export const OrgMember = model<IOrgMember>(
  "AppOrgMember",
  OrgMemberSchema,
  "app_org_members"
);

// ─── Organization Invites ─────────────────────────────────────────────────────

export interface IOrgInvite extends Document {
  orgId: string;
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const OrgInviteSchema = new Schema<IOrgInvite>(
  {
    orgId:     { type: String, required: true, index: true },
    email:     { type: String, required: true },
    role:      { type: String, default: "developer" },
    token:     { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "app_org_invites" }
);

export const OrgInvite = model<IOrgInvite>(
  "AppOrgInvite",
  OrgInviteSchema,
  "app_org_invites"
);

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface IProject extends Document {
  orgId: string;
  name: string;
  slug: string;
  description?: string;

  storageType?: string;
  storageUrl?: string;
  ipfsProvider?: string;
  ipfsApiKey?: string;
  ipfsGateway?: string;

  chainId?: number;
  contractAddress?: string;
  rpcUrl?: string;
  internalApiKey?: string;

  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    orgId:           { type: String, required: true },
    name:            { type: String, required: true },
    slug:            { type: String, required: true },
    description:     { type: String },
    storageType:     { type: String, default: "memory" },
    storageUrl:      { type: String },
    ipfsProvider:    { type: String, default: "pinata" },
    ipfsApiKey:      { type: String },
    ipfsGateway:     { type: String },
    chainId:         { type: Number },
    contractAddress: { type: String },
    rpcUrl:          { type: String },
    internalApiKey:  { type: String },
  },
  { timestamps: true, collection: "app_projects" }
);

ProjectSchema.index({ orgId: 1, slug: 1 }, { unique: true });

export const Project = model<IProject>(
  "AppProject",
  ProjectSchema,
  "app_projects"
);

// ─── API Keys ─────────────────────────────────────────────────────────────────

export interface IApiKey extends Document {
  projectId: string;
  name: string;
  keyHash: string;       // SHA-256 — never store plaintext
  prefix: string;        // first 8 chars shown in UI
  permissions: string;   // "read" | "write" | "admin"
  expiresAt?: Date | null;
  lastUsedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    projectId:   { type: String, required: true, index: true },
    name:        { type: String, required: true },
    keyHash:     { type: String, required: true, unique: true },
    prefix:      { type: String, required: true },
    permissions: { type: String, default: "read" },
    expiresAt:   { type: Date, default: null },
    lastUsedAt:  { type: Date, default: null },
    revokedAt:   { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "app_api_keys" }
);

export const ApiKey = model<IApiKey>(
  "AppApiKey",
  ApiKeySchema,
  "app_api_keys"
);

// ─── Usage Records ────────────────────────────────────────────────────────────

export interface IUsageRecord extends Document {
  projectId: string;
  apiKeyId?: string;
  endpoint: string;
  statusCode?: number;
  timestamp: Date;
}

const UsageRecordSchema = new Schema<IUsageRecord>(
  {
    projectId:  { type: String, required: true },
    apiKeyId:   { type: String },
    endpoint:   { type: String, required: true },
    statusCode: { type: Number },
    timestamp:  { type: Date, default: () => new Date() },
  },
  { collection: "app_usage_records" }
);

UsageRecordSchema.index({ projectId: 1, timestamp: -1 });

export const UsageRecord = model<IUsageRecord>(
  "AppUsageRecord",
  UsageRecordSchema,
  "app_usage_records"
);

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface IBillingPlan extends Document {
  planId: string;  // "free" | "pro" | "enterprise"
  name: string;
  apiCallLimit?: number;
  teamMemberLimit?: number;
  storageGbLimit?: number;
  price: number;   // cents/month
}

const BillingPlanSchema = new Schema<IBillingPlan>(
  {
    planId:          { type: String, required: true, unique: true },
    name:            { type: String, required: true },
    apiCallLimit:    { type: Number },
    teamMemberLimit: { type: Number },
    storageGbLimit:  { type: Number },
    price:           { type: Number, default: 0 },
  },
  { collection: "app_billing_plans" }
);

export const BillingPlan = model<IBillingPlan>(
  "AppBillingPlan",
  BillingPlanSchema,
  "app_billing_plans"
);

export interface IOrgSubscription extends Document {
  orgId: string;
  planId: string;
  stripeCustomerId?: string;
  stripeSubId?: string;
  status: string;
  createdAt: Date;
}

const OrgSubscriptionSchema = new Schema<IOrgSubscription>(
  {
    orgId:            { type: String, required: true, index: true },
    planId:           { type: String, required: true },
    stripeCustomerId: { type: String },
    stripeSubId:      { type: String },
    status:           { type: String, default: "active" },
    createdAt:        { type: Date, default: () => new Date() },
  },
  { collection: "app_org_subscriptions" }
);

export const OrgSubscription = model<IOrgSubscription>(
  "AppOrgSubscription",
  OrgSubscriptionSchema,
  "app_org_subscriptions"
);

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface IAuditLog extends Document {
  orgId?: string;
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    orgId:      { type: String, index: true },
    userId:     { type: String },
    action:     { type: String, required: true },
    resource:   { type: String },
    resourceId: { type: String },
    metadata:   { type: Schema.Types.Mixed },
    timestamp:  { type: Date, default: () => new Date() },
  },
  { collection: "app_audit_logs" }
);

AuditLogSchema.index({ orgId: 1, timestamp: -1 });

export const AuditLog = model<IAuditLog>(
  "AppAuditLog",
  AuditLogSchema,
  "app_audit_logs"
);

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export interface IWebhook extends Document {
  projectId: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  createdAt: Date;
}

const WebhookSchema = new Schema<IWebhook>(
  {
    projectId: { type: String, required: true, index: true },
    url:       { type: String, required: true },
    events:    { type: [String], default: [] },
    secret:    { type: String },
    active:    { type: Boolean, default: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "app_webhooks" }
);

export const Webhook = model<IWebhook>(
  "AppWebhook",
  WebhookSchema,
  "app_webhooks"
);
