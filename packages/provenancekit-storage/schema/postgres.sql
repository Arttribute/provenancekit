-- ProvenanceKit — PostgreSQL Schema
-- Version: 0.0.1
--
-- Run this against any PostgreSQL 14+ database to create the provenance tables.
-- The default table prefix is "pk_". Override by replacing "pk_" globally.
--
-- Usage:
--   psql $DATABASE_URL -f postgres.sql
--
-- The PostgresStorage adapter also calls this automatically on initialize()
-- when autoMigrate: true (the default).

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
  id             TEXT PRIMARY KEY,
  resource_ref   TEXT,
  resource_scheme TEXT,
  action_id      TEXT,
  entity_id      TEXT NOT NULL REFERENCES pk_entity(id),
  role           TEXT NOT NULL,
  note           TEXT,
  extensions     JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
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

-- GIN indexes for fast JSONB extension queries (e.g. findByExtension)
CREATE INDEX IF NOT EXISTS idx_pk_resource_extensions  ON pk_resource  USING GIN (extensions);
CREATE INDEX IF NOT EXISTS idx_pk_action_extensions    ON pk_action    USING GIN (extensions);

-- ─── Optional: Vector Embeddings (pgvector) ───────────────────────────────────
-- Uncomment if using semantic similarity search (requires pgvector extension).
-- PostgresStorage currently stores embeddings as JSON; SupabaseStorage uses
-- native pgvector. Add pgvector support by extending the adapter if needed.
--
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
