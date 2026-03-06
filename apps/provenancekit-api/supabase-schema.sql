-- ProvenanceKit — Supabase Schema Migration
-- Run this in the Supabase SQL Editor (supabase.com > your project > SQL Editor)
-- Generated from SupabaseStorage.generateSchema({ enableVectors: true, vectorDimension: 768 })

-- Enable pgvector extension (required for semantic search)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Core provenance tables ───────────────────────────────────────────────────

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

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pk_resource_type ON pk_resource(type);
CREATE INDEX IF NOT EXISTS idx_pk_resource_created_by ON pk_resource(created_by);
CREATE INDEX IF NOT EXISTS idx_pk_action_type ON pk_action(type);
CREATE INDEX IF NOT EXISTS idx_pk_action_performed_by ON pk_action(performed_by);
CREATE INDEX IF NOT EXISTS idx_pk_attribution_resource ON pk_attribution(resource_ref);
CREATE INDEX IF NOT EXISTS idx_pk_attribution_action ON pk_attribution(action_id);
CREATE INDEX IF NOT EXISTS idx_pk_attribution_entity ON pk_attribution(entity_id);

CREATE INDEX IF NOT EXISTS idx_pk_resource_extensions ON pk_resource USING GIN (extensions);
CREATE INDEX IF NOT EXISTS idx_pk_action_extensions ON pk_action USING GIN (extensions);

-- ─── Vector search (pgvector — dimension 768 matches Xenova CLIP default) ─────

CREATE TABLE IF NOT EXISTS pk_embedding (
  id SERIAL PRIMARY KEY,
  ref TEXT NOT NULL REFERENCES pk_resource(ref),
  embedding vector(768),
  kind TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pk_embedding_ref ON pk_embedding(ref);

CREATE OR REPLACE FUNCTION pk_match_embeddings(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_type text DEFAULT NULL
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

CREATE TABLE IF NOT EXISTS pk_encrypted_embedding (
  ref TEXT PRIMARY KEY REFERENCES pk_resource(ref),
  blob TEXT NOT NULL,
  kind TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pk_encrypted_embedding_created
  ON pk_encrypted_embedding(created_at);
