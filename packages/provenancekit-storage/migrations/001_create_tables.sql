-- ProvenanceKit Database Schema
-- Run this in your Supabase SQL Editor or as a migration.
--
-- This creates the core provenance tables with JSONB extensions columns
-- and optional pgvector support for embedding-based similarity search.

-- Enable pgvector if you plan to use embedding search
-- CREATE EXTENSION IF NOT EXISTS vector;

/*──────────────────────────────────────────────────────────────────*\
 | Entity Table                                                      |
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
 | Resource Table                                                    |
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

CREATE INDEX IF NOT EXISTS idx_pk_resource_type ON pk_resource(type);
CREATE INDEX IF NOT EXISTS idx_pk_resource_created_by ON pk_resource(created_by);
CREATE INDEX IF NOT EXISTS idx_pk_resource_extensions ON pk_resource USING GIN (extensions);

/*──────────────────────────────────────────────────────────────────*\
 | Action Table                                                      |
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

CREATE INDEX IF NOT EXISTS idx_pk_action_type ON pk_action(type);
CREATE INDEX IF NOT EXISTS idx_pk_action_performed_by ON pk_action(performed_by);
CREATE INDEX IF NOT EXISTS idx_pk_action_extensions ON pk_action USING GIN (extensions);

/*──────────────────────────────────────────────────────────────────*\
 | Attribution Table                                                 |
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
CREATE INDEX IF NOT EXISTS idx_pk_attribution_action ON pk_attribution(action_id);
CREATE INDEX IF NOT EXISTS idx_pk_attribution_entity ON pk_attribution(entity_id);

/*──────────────────────────────────────────────────────────────────*\
 | Embedding Table (optional — requires pgvector extension)          |
\*──────────────────────────────────────────────────────────────────*/

-- Uncomment and adjust dimension (768 for CLIP, 1536 for OpenAI) if using embeddings:
--
-- CREATE TABLE IF NOT EXISTS pk_embedding (
--   ref       TEXT PRIMARY KEY REFERENCES pk_resource(ref),
--   embedding vector(768) NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_pk_embedding_vec
--   ON pk_embedding USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);
