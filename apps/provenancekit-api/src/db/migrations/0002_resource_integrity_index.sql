-- Migration: add index on pk_resource.integrity for fast pre-upload duplicate detection
--
-- The integrity column stores `sha256:{hex}` for unencrypted resources.
-- This index makes getResourceByIntegrity() a cheap single-row lookup (~10ms)
-- instead of requiring a full IPFS upload (~500-2000ms) before discovering a duplicate.
-- Without this index, large tables would require a sequential scan on every activity request.

CREATE INDEX IF NOT EXISTS idx_pk_resource_integrity ON pk_resource(integrity)
  WHERE integrity IS NOT NULL;
