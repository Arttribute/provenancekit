/**
 * Drizzle ORM client for provenancekit-api.
 *
 * Uses the postgres driver with `prepare: false` for Supabase's pgBouncer
 * transaction pooler (the default Supabase connection string).
 *
 * The database is the same Supabase instance shared with provenancekit-app.
 * Table namespaces keep the two services' data logically separated:
 *   pk_api_* → owned by this API
 *   app_*    → owned by provenancekit-app
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDb | null = null;

/**
 * Get the Drizzle DB client (lazy-initialized singleton).
 * Returns null when DATABASE_URL is not configured (dev/memory mode).
 */
export function getDb(): DrizzleDb | null {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) return null;

  const sql = postgres(url, {
    prepare: false,  // Required for Supabase pgBouncer / transaction pooler
    max: 5,          // Small pool — API is stateless across requests
  });

  _db = drizzle(sql, { schema });
  return _db;
}
