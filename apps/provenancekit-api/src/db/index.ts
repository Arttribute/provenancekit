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
    prepare: false,       // Required for Supabase pgBouncer / transaction pooler
    max: 5,               // Small pool — API is stateless; Cloud Run scales horizontally
    idle_timeout: 20,     // Release idle connections after 20s (Cloud Run instances shut down fast)
    connect_timeout: 10,  // Fail fast on connection errors rather than hanging a request
    max_lifetime: 1800,   // Recycle connections every 30 min to avoid stale TCP issues
  });

  _db = drizzle(sql, { schema });
  return _db;
}
