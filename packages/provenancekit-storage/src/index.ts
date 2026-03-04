/**
 * ProvenanceKit Storage
 *
 * Unified storage abstraction for provenance data and files.
 *
 * ## Database Storage (Provenance Data)
 * Store entities, actions, resources, and attributions.
 *
 * ```typescript
 * import { MemoryDbStorage } from "@provenancekit/storage/adapters/db/memory";
 * // Or: import { PostgresStorage } from "@provenancekit/storage/adapters/db/postgres";
 *
 * const db = new MemoryDbStorage();
 * await db.initialize();
 *
 * await db.upsertEntity({ id: "user:alice", role: "human", name: "Alice" });
 * ```
 *
 * ## File Storage (Content)
 * Store and retrieve content-addressed files.
 *
 * ```typescript
 * import { PinataStorage } from "@provenancekit/storage/adapters/files/ipfs-pinata";
 * // Or: import { MemoryFileStorage } from "@provenancekit/storage/adapters/files/memory";
 *
 * const files = new PinataStorage({ jwt: process.env.PINATA_JWT! });
 * await files.initialize();
 *
 * const result = await files.upload(Buffer.from("Hello, world!"));
 * console.log("CID:", result.ref.ref);
 * ```
 *
 * @packageDocumentation
 */

// Database storage
export * from "./db";

// File storage
export * from "./files";

// Utilities
export * from "./utils";
