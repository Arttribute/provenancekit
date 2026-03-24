-- ProvenanceKit — Supabase Schema
-- Version: 0.0.1
--
-- Paste this into the Supabase SQL Editor and run it to create the provenance tables.
-- The default table prefix is "pk_". Override by replacing "pk_" globally.
--
-- This schema is also programmatically available via:
--   SupabaseStorage.generateSchema({ enableVectors: true })
--
-- For vector similarity search (semantic search), uncomment the vector sections below.
-- This requires the pgvector extension to be enabled in your Supabase project:
--   Database → Extensions → Enable "vector"

-- ─── Core Provenance Tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pk_entity (
  id         TEXT PRIMARY KEY,
  role       TEXT NOT NULL,
  name       TEXT,
  public_key TEXT,
  metadata   JSONB DEFAULT '{}',
  extensions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pk_resource (
  ref          TEXT PRIMARY KEY,
  scheme       TEXT NOT NULL,
  integrity    TEXT,
  size         INTEGER,
  type         TEXT NOT NULL,
  locations    JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL,
  created_by   TEXT NOT NULL REFERENCES pk_entity(id),
  root_action  TEXT NOT NULL,
  extensions   JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS pk_action (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  performed_by TEXT NOT NULL REFERENCES pk_entity(id),
  timestamp    TIMESTAMPTZ NOT NULL,
  inputs       JSONB DEFAULT '[]',
  outputs      JSONB DEFAULT '[]',
  proof        TEXT,
  extensions   JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS pk_attribution (
  id              TEXT PRIMARY KEY,
  resource_ref    TEXT,
  resource_scheme TEXT,
  action_id       TEXT,
  entity_id       TEXT NOT NULL REFERENCES pk_entity(id),
  role            TEXT NOT NULL,
  note            TEXT,
  extensions      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT attr_target_check CHECK (resource_ref IS NOT NULL OR action_id IS NOT NULL)
);

-- ─── Ownership State ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pk_ownership_state (
  resource_ref      TEXT PRIMARY KEY REFERENCES pk_resource(ref) ON DELETE CASCADE,
  current_owner_id  TEXT NOT NULL REFERENCES pk_entity(id),
  last_transfer_id  TEXT REFERENCES pk_action(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pk_resource_type        ON pk_resource(type);
CREATE INDEX IF NOT EXISTS idx_pk_resource_created_by  ON pk_resource(created_by);
CREATE INDEX IF NOT EXISTS idx_pk_action_type          ON pk_action(type);
CREATE INDEX IF NOT EXISTS idx_pk_action_performed_by  ON pk_action(performed_by);
CREATE INDEX IF NOT EXISTS idx_pk_attribution_resource ON pk_attribution(resource_ref);
CREATE INDEX IF NOT EXISTS idx_pk_attribution_action   ON pk_attribution(action_id);
CREATE INDEX IF NOT EXISTS idx_pk_attribution_entity   ON pk_attribution(entity_id);
CREATE INDEX IF NOT EXISTS idx_pk_ownership_owner      ON pk_ownership_state(current_owner_id);

CREATE INDEX IF NOT EXISTS idx_pk_resource_extensions  ON pk_resource  USING GIN (extensions);
CREATE INDEX IF NOT EXISTS idx_pk_action_extensions    ON pk_action    USING GIN (extensions);

-- ─── Optional: Vector Embeddings (pgvector) ───────────────────────────────────
-- Required for /similar endpoint (semantic similarity search).
-- Enable pgvector in Supabase: Database → Extensions → vector

-- CREATE EXTENSION IF NOT EXISTS vector;
--
-- CREATE TABLE IF NOT EXISTS pk_embedding (
--   ref        TEXT PRIMARY KEY REFERENCES pk_resource(ref) ON DELETE CASCADE,
--   embedding  vector(1536) NOT NULL,
--   kind       TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_pk_embedding_ref ON pk_embedding(ref);
--
-- -- Similarity search function (called by SupabaseStorage internally)
-- CREATE OR REPLACE FUNCTION pk_match_embeddings(
--   query_embedding vector(1536),
--   match_threshold float,
--   match_count     int,
--   filter_type     text DEFAULT NULL
-- )
-- RETURNS TABLE (ref text, similarity float)
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   RETURN QUERY
--   SELECT e.ref, 1 - (e.embedding <=> query_embedding) AS similarity
--   FROM pk_embedding e
--   LEFT JOIN pk_resource r ON e.ref = r.ref
--   WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
--     AND (filter_type IS NULL OR r.type = filter_type)
--   ORDER BY e.embedding <=> query_embedding
--   LIMIT match_count;
-- END;
-- $$;
--
-- -- Encrypted embedding table (client-side encryption; server cannot read vectors)
-- CREATE TABLE IF NOT EXISTS pk_encrypted_embedding (
--   ref        TEXT PRIMARY KEY REFERENCES pk_resource(ref) ON DELETE CASCADE,
--   blob       TEXT NOT NULL,
--   kind       TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- ─── Required: pk_exec_sql helper (for autoMigrate: true) ─────────────────────
-- SupabaseStorage.initialize() with autoMigrate: true calls this function.
-- If you prefer to run migrations manually (recommended for production), you can
-- skip this function and just run the SQL above directly.

-- CREATE OR REPLACE FUNCTION pk_exec_sql(sql text)
-- RETURNS void
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--   EXECUTE sql;
-- END;
-- $$;
