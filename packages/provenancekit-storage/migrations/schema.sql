-- ProvenanceKit — Complete Database Schema
--
-- Single source of truth for the ProvenanceKit storage schema.
-- This file contains the full, current schema. Apply it once on a fresh
-- database to have everything in place.
--
-- Providers:
--   PostgreSQL  — apply via psql or any migration tool
--   Supabase    — paste into the SQL Editor and run
--   Others      — adapt DDL as needed (e.g., remove TIMESTAMPTZ for SQLite)
--
-- NOTE: When using provenancekit-api, all tables are created automatically
-- at startup. You only need this file if using @provenancekit/storage directly
-- without the API startup runner.

/*──────────────────────────────────────────────────────────────────*\
 | Entity Table                                                       |
 | Represents humans, AI systems, organisations, or any actor that    |
 | can create, modify, or verify resources.                           |
\*──────────────────────────────────────────────────────────────────*/

CREATE TABLE IF NOT EXISTS pk_entity (
  id          TEXT PRIMARY KEY,
  role        TEXT NOT NULL,
  name        TEXT,
  public_key  TEXT,
  metadata    JSONB DEFAULT '{}',
  extensions  JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

/*──────────────────────────────────────────────────────────────────*\
 | Resource Table                                                     |
 | Content-addressed artifacts. `created_by` is the registrant       |
 | (uploader) and is IMMUTABLE — it never changes, even after an     |
 | ownership transfer.                                                |
\*──────────────────────────────────────────────────────────────────*/

CREATE TABLE IF NOT EXISTS pk_resource (
  ref         TEXT PRIMARY KEY,
  scheme      TEXT NOT NULL,
  integrity   TEXT,
  size        INTEGER,
  type        TEXT NOT NULL,
  locations   JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL,
  created_by  TEXT NOT NULL REFERENCES pk_entity(id),
  root_action TEXT NOT NULL,
  extensions  JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pk_resource_type       ON pk_resource(type);
CREATE INDEX IF NOT EXISTS idx_pk_resource_created_by ON pk_resource(created_by);
CREATE INDEX IF NOT EXISTS idx_pk_resource_extensions ON pk_resource USING GIN (extensions);

/*──────────────────────────────────────────────────────────────────*\
 | Action Table                                                       |
 | Immutable provenance events: creation, transformation, ownership   |
 | claims, transfers, witness attestations, etc.                      |
\*──────────────────────────────────────────────────────────────────*/

CREATE TABLE IF NOT EXISTS pk_action (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  performed_by  TEXT NOT NULL REFERENCES pk_entity(id),
  timestamp     TIMESTAMPTZ NOT NULL,
  inputs        JSONB DEFAULT '[]',
  outputs       JSONB DEFAULT '[]',
  proof         TEXT,
  extensions    JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pk_action_type         ON pk_action(type);
CREATE INDEX IF NOT EXISTS idx_pk_action_performed_by ON pk_action(performed_by);
CREATE INDEX IF NOT EXISTS idx_pk_action_extensions   ON pk_action USING GIN (extensions);

/*──────────────────────────────────────────────────────────────────*\
 | Attribution Table                                                  |
 | Links entities to the resources and actions they are involved in.  |
\*──────────────────────────────────────────────────────────────────*/

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

CREATE INDEX IF NOT EXISTS idx_pk_attribution_resource ON pk_attribution(resource_ref);
CREATE INDEX IF NOT EXISTS idx_pk_attribution_action   ON pk_attribution(action_id);
CREATE INDEX IF NOT EXISTS idx_pk_attribution_entity   ON pk_attribution(entity_id);

/*──────────────────────────────────────────────────────────────────*\
 | Ownership State Table                                              |
 | Materialized cache of who owns each resource RIGHT NOW.           |
 |                                                                    |
 | Design:                                                            |
 |   - This is a DERIVED VIEW of the pk_action chain. The action     |
 |     chain (ext:ownership:transfer@* actions) is always the        |
 |     authoritative record; this table exists for fast queries.     |
 |   - `current_owner_id` starts as pk_resource.created_by and is   |
 |     updated atomically each time a transfer Action is written.    |
 |   - Ownership CLAIMS (ext:ownership:claim@*) do NOT modify this   |
 |     table — they are immutable audit events in pk_action only.    |
 |   - `last_transfer_id` is NULL when never transferred.            |
\*──────────────────────────────────────────────────────────────────*/

CREATE TABLE IF NOT EXISTS pk_ownership_state (
  resource_ref       TEXT PRIMARY KEY REFERENCES pk_resource(ref),
  current_owner_id   TEXT NOT NULL REFERENCES pk_entity(id),
  last_transfer_id   TEXT REFERENCES pk_action(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for "list all resources owned by entity X"
CREATE INDEX IF NOT EXISTS idx_pk_ownership_current_owner
  ON pk_ownership_state(current_owner_id);

/*──────────────────────────────────────────────────────────────────*\
 | Embedding Tables (requires pgvector extension)                     |
 | Dimension guide:                                                   |
 |   512  — Xenova/clip-vit-base-patch16 (ViT-Base/16, API default)  |
 |   768  — CLIP ViT-Large/14 or BGE-M3                              |
 |   1536 — OpenAI text-embedding-ada-002                            |
\*──────────────────────────────────────────────────────────────────*/

CREATE EXTENSION IF NOT EXISTS vector;

-- Plaintext embeddings for server-side cosine similarity search
CREATE TABLE IF NOT EXISTS pk_embedding (
  ref        TEXT PRIMARY KEY REFERENCES pk_resource(ref) ON DELETE CASCADE,
  embedding  vector(512) NOT NULL,
  kind       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pk_embedding_ref ON pk_embedding(ref);

CREATE INDEX IF NOT EXISTS idx_pk_embedding_vec
  ON pk_embedding USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE OR REPLACE FUNCTION pk_match_embeddings(
  query_embedding vector(512),
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

-- Encrypted embedding blobs — server stores opaque ciphertext only.
-- The key holder decrypts and searches client-side.
CREATE TABLE IF NOT EXISTS pk_encrypted_embedding (
  ref        TEXT PRIMARY KEY REFERENCES pk_resource(ref) ON DELETE CASCADE,
  blob       TEXT NOT NULL,
  kind       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pk_encrypted_embedding_created
  ON pk_encrypted_embedding(created_at);
