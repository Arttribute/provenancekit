-- ProvenanceKit — Fix pk_embedding schema
--
-- Recreates pk_embedding with:
--   - ref TEXT PRIMARY KEY (was id SERIAL PRIMARY KEY in some deployments)
--   - vector(512) — correct dimension for Xenova/clip-vit-base-patch16
--   - kind TEXT column for media-type tagging
--   - ON DELETE CASCADE on the pk_resource foreign key
--
-- Also drops and recreates pk_match_embeddings with the correct vector(512)
-- parameter type (PostgreSQL treats vector(512) and vector(768) as distinct
-- types, so the old function signature must be explicitly dropped).
--
-- Existing embeddings are discarded and will be regenerated on the next
-- activity write for each resource.
--
-- Run in:
--   Supabase  → SQL Editor → paste and click Run
--   PostgreSQL → psql -f 003_fix_embedding_dimension.sql
--
-- Safe to run on a fresh database (DROP IF EXISTS).
-- NOTE: provenancekit-api runs this automatically at startup via the
-- built-in migration runner — no manual steps required.

DROP INDEX IF EXISTS idx_pk_embedding_vec;
DROP INDEX IF EXISTS idx_pk_embedding_ref;
DROP TABLE IF EXISTS pk_embedding;
DROP FUNCTION IF EXISTS pk_match_embeddings(vector, float, int, text);
DROP FUNCTION IF EXISTS pk_match_embeddings(vector(768), float, int, text);
DROP FUNCTION IF EXISTS pk_match_embeddings(vector(512), float, int, text);
DROP FUNCTION IF EXISTS pk_match_embeddings(vector(1536), float, int, text);

CREATE TABLE pk_embedding (
  ref        TEXT PRIMARY KEY REFERENCES pk_resource(ref) ON DELETE CASCADE,
  embedding  vector(512) NOT NULL,
  kind       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pk_embedding_ref ON pk_embedding(ref);

CREATE INDEX idx_pk_embedding_vec
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
