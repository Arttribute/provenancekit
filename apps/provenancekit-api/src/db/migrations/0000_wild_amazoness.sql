CREATE TABLE "app_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"permissions" text DEFAULT 'read' NOT NULL,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "app_org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'developer' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_org_member" UNIQUE("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "app_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "app_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"storage_type" text DEFAULT 'supabase',
	"storage_url" text,
	"ipfs_provider" text DEFAULT 'pinata',
	"ipfs_api_key" text,
	"ipfs_gateway" text,
	"chain_id" integer,
	"contract_address" text,
	"rpc_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_project_slug" UNIQUE("org_id","slug")
);
--> statement-breakpoint
CREATE TABLE "app_usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"api_key_id" uuid,
	"endpoint" text NOT NULL,
	"resource_type" text,
	"status_code" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"privy_did" text NOT NULL,
	"email" text,
	"wallet" text,
	"name" text,
	"avatar" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_users_privy_did_unique" UNIQUE("privy_did")
);
--> statement-breakpoint
CREATE TABLE "pk_api_entity_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" text NOT NULL,
	"flag" text NOT NULL,
	"reason" text,
	"flagged_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "pk_api_entity_flags_entity_id_unique" UNIQUE("entity_id")
);
--> statement-breakpoint
ALTER TABLE "app_api_keys" ADD CONSTRAINT "app_api_keys_project_id_app_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."app_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_org_members" ADD CONSTRAINT "app_org_members_org_id_app_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."app_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_projects" ADD CONSTRAINT "app_projects_org_id_app_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."app_organizations"("id") ON DELETE cascade ON UPDATE no action;