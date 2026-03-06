/**
 * API-specific supplementary schema (pk_api_* prefix)
 *
 * These tables extend the core EAA storage schema with platform-level
 * concerns (entity moderation, etc.). They live alongside — and never
 * modify — the storage-layer pk_* tables.
 *
 * Run PK_API_SCHEMA_SQL in your Supabase SQL editor once to provision.
 */

/*─────────────────────────────────────────────────────────────*\
 | Types                                                        |
\*─────────────────────────────────────────────────────────────*/

export type EntityFlagKind = "suspended" | "banned" | "flagged";

export interface EntityFlag {
  id: string;
  entityId: string;
  flag: EntityFlagKind;
  reason?: string;
  flaggedBy?: string;
  createdAt: string;
  expiresAt?: string | null;
}

/*─────────────────────────────────────────────────────────────*\
 | DDL                                                          |
\*─────────────────────────────────────────────────────────────*/

export const PK_API_SCHEMA_SQL = `
-- Entity moderation flags (suspensions, bans, etc.)
CREATE TABLE IF NOT EXISTS pk_api_entity_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   TEXT        NOT NULL UNIQUE,
  flag        TEXT        NOT NULL CHECK (flag IN ('suspended', 'banned', 'flagged')),
  reason      TEXT,
  flagged_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pk_api_entity_flags_entity_id
  ON pk_api_entity_flags(entity_id);
`;
