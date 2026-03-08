-- ProvenanceKit — Add Ownership State Table
--
-- Apply this to any existing database that was set up with 001_create_tables.sql
-- (or an older version of schema.sql that did not include pk_ownership_state).
--
-- Run in:
--   Supabase  → SQL Editor → paste and click Run
--   PostgreSQL → psql -f 002_add_ownership.sql
--
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS pk_ownership_state (
  resource_ref       TEXT PRIMARY KEY REFERENCES pk_resource(ref),
  current_owner_id   TEXT NOT NULL REFERENCES pk_entity(id),
  last_transfer_id   TEXT REFERENCES pk_action(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pk_ownership_current_owner
  ON pk_ownership_state(current_owner_id);
