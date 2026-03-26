/**
 * ProvenanceKit API — Auto-Migration Runner
 *
 * Runs all schema migrations at startup using a direct postgres connection.
 * Migrations are tracked in `pk_migrations` and are idempotent — safe to
 * run on both fresh databases and existing ones.
 *
 * Covers two table namespaces:
 *   app_*  — control-plane tables (users, orgs, projects, API keys, usage)
 *   pk_*   — provenance tables (entities, resources, actions, embeddings)
 */

import postgres from "postgres";

interface Migration {
  id: string;
  sql: string;
}

function buildMigrations(vectorDimension: number): Migration[] {
  return [
    // ─── app_* tables ─────────────────────────────────────────────────────────

    {
      id: "0000_app_initial_schema",
      sql: `
        CREATE TABLE IF NOT EXISTS "app_users" (
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

        CREATE TABLE IF NOT EXISTS "app_organizations" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "name" text NOT NULL,
          "slug" text NOT NULL,
          "plan" text DEFAULT 'free' NOT NULL,
          "owner_id" text NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "app_organizations_slug_unique" UNIQUE("slug")
        );

        CREATE TABLE IF NOT EXISTS "app_org_members" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "org_id" uuid NOT NULL REFERENCES "app_organizations"("id") ON DELETE cascade,
          "user_id" text NOT NULL,
          "role" text DEFAULT 'developer' NOT NULL,
          "joined_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "uq_org_member" UNIQUE("org_id", "user_id")
        );

        CREATE TABLE IF NOT EXISTS "app_projects" (
          "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "org_id"              uuid NOT NULL REFERENCES "app_organizations"("id") ON DELETE cascade,
          "name"                text NOT NULL,
          "slug"                text NOT NULL,
          "description"         text,
          "storage_type"        text DEFAULT 'supabase',
          "ipfs_provider"       text DEFAULT 'pinata',
          "ipfs_api_key"        text,
          "ipfs_gateway"        text,
          "api_url"             text,
          "ai_training_opt_out" boolean DEFAULT false NOT NULL,
          "chain_id"            integer,
          "contract_address"    text,
          "rpc_url"             text,
          "created_at"          timestamp DEFAULT now() NOT NULL,
          "updated_at"          timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "uq_project_slug" UNIQUE("org_id", "slug")
        );

        CREATE TABLE IF NOT EXISTS "app_api_keys" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "project_id" uuid NOT NULL REFERENCES "app_projects"("id") ON DELETE cascade,
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

        CREATE TABLE IF NOT EXISTS "app_usage_records" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "project_id" uuid NOT NULL,
          "api_key_id" uuid,
          "endpoint" text NOT NULL,
          "resource_type" text,
          "status_code" integer,
          "timestamp" timestamp DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "pk_api_entity_flags" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "entity_id" text NOT NULL,
          "flag" text NOT NULL,
          "reason" text,
          "flagged_by" text,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "expires_at" timestamp,
          CONSTRAINT "pk_api_entity_flags_entity_id_unique" UNIQUE("entity_id")
        );
      `,
    },

    {
      id: "0001_app_schema_drift",
      sql: `
        ALTER TABLE "app_projects" ADD COLUMN IF NOT EXISTS "api_url" text;
        ALTER TABLE "app_projects" ADD COLUMN IF NOT EXISTS "ai_training_opt_out" boolean DEFAULT false NOT NULL;
        ALTER TABLE "app_projects" DROP COLUMN IF EXISTS "storage_url";
      `,
    },

    // ─── pk_* provenance tables ────────────────────────────────────────────────

    {
      id: "0002_pk_base_schema",
      sql: `
        CREATE TABLE IF NOT EXISTS pk_entity (
          id TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          name TEXT,
          public_key TEXT,
          metadata JSONB DEFAULT '{}',
          extensions JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS pk_resource (
          ref TEXT PRIMARY KEY,
          scheme TEXT NOT NULL,
          integrity TEXT,
          size INTEGER,
          type TEXT NOT NULL,
          locations JSONB DEFAULT '[]',
          created_at TIMESTAMPTZ NOT NULL,
          created_by TEXT NOT NULL REFERENCES pk_entity(id),
          root_action TEXT NOT NULL,
          extensions JSONB DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS pk_action (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          performed_by TEXT NOT NULL REFERENCES pk_entity(id),
          timestamp TIMESTAMPTZ NOT NULL,
          inputs JSONB DEFAULT '[]',
          outputs JSONB DEFAULT '[]',
          proof TEXT,
          extensions JSONB DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS pk_attribution (
          id TEXT PRIMARY KEY,
          resource_ref TEXT,
          resource_scheme TEXT,
          action_id TEXT,
          entity_id TEXT NOT NULL REFERENCES pk_entity(id),
          role TEXT NOT NULL,
          note TEXT,
          extensions JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT attr_target_check CHECK (resource_ref IS NOT NULL OR action_id IS NOT NULL)
        );

        CREATE INDEX IF NOT EXISTS idx_pk_resource_type ON pk_resource(type);
        CREATE INDEX IF NOT EXISTS idx_pk_resource_created_by ON pk_resource(created_by);
        CREATE INDEX IF NOT EXISTS idx_pk_action_type ON pk_action(type);
        CREATE INDEX IF NOT EXISTS idx_pk_action_performed_by ON pk_action(performed_by);
        CREATE INDEX IF NOT EXISTS idx_pk_attribution_resource ON pk_attribution(resource_ref);
        CREATE INDEX IF NOT EXISTS idx_pk_attribution_action ON pk_attribution(action_id);
        CREATE INDEX IF NOT EXISTS idx_pk_attribution_entity ON pk_attribution(entity_id);
        CREATE INDEX IF NOT EXISTS idx_pk_resource_extensions ON pk_resource USING GIN (extensions);
        CREATE INDEX IF NOT EXISTS idx_pk_action_extensions ON pk_action USING GIN (extensions);
      `,
    },

    {
      // Ownership state — materialized cache of current resource owner.
      // Safe to rebuild from the action chain if lost.
      id: "0003_pk_ownership",
      sql: `
        CREATE TABLE IF NOT EXISTS pk_ownership_state (
          resource_ref       TEXT PRIMARY KEY REFERENCES pk_resource(ref),
          current_owner_id   TEXT NOT NULL REFERENCES pk_entity(id),
          last_transfer_id   TEXT REFERENCES pk_action(id),
          updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_pk_ownership_current_owner
          ON pk_ownership_state(current_owner_id);
      `,
    },

    {
      // Partial index on pk_resource.integrity for fast pre-upload duplicate detection.
      // integrity stores `sha256:{hex}` for unencrypted resources.
      // Lets getResourceByIntegrity() skip IPFS upload (~1s) for duplicates across
      // Cloud Run instances and cold starts — now just a ~10ms indexed DB lookup.
      id: "0005_pk_resource_integrity_index",
      sql: `
        CREATE INDEX IF NOT EXISTS idx_pk_resource_integrity
          ON pk_resource(integrity)
          WHERE integrity IS NOT NULL;
      `,
    },

    {
      // Vector embeddings — recreate with correct dimension and primary key schema.
      // Existing data is discarded and will be regenerated on next activity write.
      id: `0004_pk_vectors_dim${vectorDimension}`,
      sql: `
        CREATE EXTENSION IF NOT EXISTS vector;

        -- Drop any existing embedding table and function (dimension may have changed)
        DROP INDEX IF EXISTS idx_pk_embedding_vec;
        DROP TABLE IF EXISTS pk_embedding;
        DROP FUNCTION IF EXISTS pk_match_embeddings(vector, float, int, text);
        DROP FUNCTION IF EXISTS pk_match_embeddings(vector(768), float, int, text);
        DROP FUNCTION IF EXISTS pk_match_embeddings(vector(512), float, int, text);
        DROP FUNCTION IF EXISTS pk_match_embeddings(vector(1536), float, int, text);

        CREATE TABLE pk_embedding (
          ref        TEXT PRIMARY KEY REFERENCES pk_resource(ref) ON DELETE CASCADE,
          embedding  vector(${vectorDimension}) NOT NULL,
          kind       TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX idx_pk_embedding_ref ON pk_embedding(ref);
        CREATE INDEX idx_pk_embedding_vec
          ON pk_embedding USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100);

        CREATE OR REPLACE FUNCTION pk_match_embeddings(
          query_embedding vector(${vectorDimension}),
          match_threshold float,
          match_count     int,
          filter_type     text DEFAULT NULL
        )
        RETURNS TABLE (ref text, similarity float)
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RETURN QUERY
          SELECT e.ref, 1 - (e.embedding <=> query_embedding) AS similarity
          FROM pk_embedding e
          LEFT JOIN pk_resource r ON e.ref = r.ref
          WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
            AND (filter_type IS NULL OR r.type = filter_type)
          ORDER BY e.embedding <=> query_embedding
          LIMIT match_count;
        END;
        $$;

        -- Encrypted embedding blob storage (client-side search only)
        CREATE TABLE IF NOT EXISTS pk_encrypted_embedding (
          ref        TEXT PRIMARY KEY REFERENCES pk_resource(ref) ON DELETE CASCADE,
          blob       TEXT NOT NULL,
          kind       TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_pk_encrypted_embedding_created
          ON pk_encrypted_embedding(created_at);
      `,
    },
  ];
}

/**
 * Run all pending migrations against the given database URL.
 *
 * Creates a `pk_migrations` tracking table on first run. Each migration is
 * idempotent — already-applied migrations are skipped. The vector migration
 * is keyed by dimension so that changing the dimension triggers a re-run
 * (dropping and recreating the embedding table).
 */
export async function runMigrations(
  databaseUrl: string,
  vectorDimension = 512
): Promise<void> {
  const sql = postgres(databaseUrl, { prepare: false, max: 1 });

  try {
    // Bootstrap the migrations tracking table
    await sql`
      CREATE TABLE IF NOT EXISTS pk_migrations (
        id         TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const migrations = buildMigrations(vectorDimension);

    // Check which migrations have already been applied
    const applied = await sql<{ id: string }[]>`SELECT id FROM pk_migrations`;
    const appliedIds = new Set(applied.map((r) => r.id));

    // Also: if the vector dimension changed, remove the old vector migration
    // so it runs again with the new dimension
    const oldVecIds = [...appliedIds].filter(
      (id) => id.startsWith("0004_pk_vectors_dim") && id !== `0004_pk_vectors_dim${vectorDimension}`
    );
    if (oldVecIds.length > 0) {
      await sql`DELETE FROM pk_migrations WHERE id = ANY(${oldVecIds})`;
      for (const id of oldVecIds) appliedIds.delete(id);
      console.log(`[migrate] Vector dimension changed — will re-run embedding migration`);
    }

    for (const migration of migrations) {
      if (appliedIds.has(migration.id)) continue;

      console.log(`[migrate] Applying ${migration.id}...`);
      await sql.unsafe(migration.sql);
      await sql`INSERT INTO pk_migrations (id) VALUES (${migration.id})`;
      console.log(`[migrate] ✓ ${migration.id}`);
    }

    console.log("[migrate] All migrations up to date");
  } finally {
    await sql.end();
  }
}
