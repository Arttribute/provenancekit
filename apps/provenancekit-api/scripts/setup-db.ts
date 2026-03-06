/**
 * setup-db.ts
 *
 * Runs all database setup in one shot:
 *   1. Provenance tables (pk_entity, pk_action, pk_attribution, etc.) via direct SQL
 *   2. Control plane tables (app_organizations, app_projects, app_api_keys, etc.) via Drizzle migrate
 *
 * Usage:
 *   pnpm db:setup
 */

import "dotenv/config";
import postgres from "postgres";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set in .env");
  process.exit(1);
}

// ─── 1. Provenance tables ──────────────────────────────────────────────────

console.log("⏳  Creating provenance tables (pk_*)...");

const sqlFile = join(__dirname, "../supabase-schema.sql");
const schema = readFileSync(sqlFile, "utf-8");

// Use a direct (non-pooler) connection for DDL — split by semicolons and run each statement
const ddlClient = postgres(DATABASE_URL, { prepare: false, max: 1 });

try {
  // Run the whole file as one shot — postgres package handles multi-statement strings
  await ddlClient.unsafe(schema);
  console.log("✓  Provenance tables ready");
} catch (err) {
  console.error("❌  Failed to create provenance tables:", err);
  await ddlClient.end();
  process.exit(1);
}

await ddlClient.end();

// ─── 2. Control plane tables ───────────────────────────────────────────────

console.log("⏳  Running Drizzle migrations (app_*)...");

const migrateClient = postgres(DATABASE_URL, { prepare: false, max: 1 });
const db = drizzle(migrateClient);

try {
  await migrate(db, {
    migrationsFolder: join(__dirname, "../src/db/migrations"),
  });
  console.log("✓  Control plane tables ready");
} catch (err) {
  console.error("❌  Drizzle migration failed:", err);
  await migrateClient.end();
  process.exit(1);
}

await migrateClient.end();

console.log("\n✅  Database setup complete. You can now start the API:\n    pnpm dev\n");
