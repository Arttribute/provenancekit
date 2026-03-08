-- Migration: sync app_projects schema with current schema.ts
--
-- The initial migration had `storage_url` which was subsequently replaced in
-- schema.ts by `api_url` (self-hosted provenancekit-api URL) and a new
-- `ai_training_opt_out` flag was added. This migration applies those changes.

ALTER TABLE "app_projects" ADD COLUMN "api_url" text;
--> statement-breakpoint
ALTER TABLE "app_projects" ADD COLUMN "ai_training_opt_out" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "app_projects" DROP COLUMN IF EXISTS "storage_url";
