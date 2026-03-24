/**
 * ProvenanceKit — MongoDB Collection & Index Setup
 * Version: 0.0.1
 *
 * Run this script against your MongoDB database to create the required
 * collections and indexes for MongoDBStorage.
 *
 * Usage:
 *   mongosh $MONGODB_URI --file mongodb.js
 *
 * Or call MongoDBStorage.initialize() in your app — it creates indexes
 * automatically when autoIndex: true (the default).
 *
 * Default collection prefix is "pk_". Override by replacing "pk_" globally
 * or by passing tablePrefix in the MongoDBStorage constructor.
 */

const prefix = "pk_";

// ─── Collections ──────────────────────────────────────────────────────────────
// MongoDB creates collections implicitly on first insert.
// Declaring them explicitly here enables validation schemas in future.

db.createCollection(`${prefix}entity`);
db.createCollection(`${prefix}resource`);
db.createCollection(`${prefix}action`);
db.createCollection(`${prefix}attribution`);
db.createCollection(`${prefix}ownership_state`);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Entity
db[`${prefix}entity`].createIndex({ id: 1 }, { unique: true });

// Resource
db[`${prefix}resource`].createIndex({ ref: 1 }, { unique: true });
db[`${prefix}resource`].createIndex({ type: 1 });
db[`${prefix}resource`].createIndex({ created_by: 1 });
db[`${prefix}resource`].createIndex({ root_action: 1 });

// Action
db[`${prefix}action`].createIndex({ id: 1 }, { unique: true });
db[`${prefix}action`].createIndex({ type: 1 });
db[`${prefix}action`].createIndex({ performed_by: 1 });
db[`${prefix}action`].createIndex({ timestamp: -1 });

// Attribution
db[`${prefix}attribution`].createIndex({ id: 1 }, { unique: true });
db[`${prefix}attribution`].createIndex({ resource_ref: 1 });
db[`${prefix}attribution`].createIndex({ action_id: 1 });
db[`${prefix}attribution`].createIndex({ entity_id: 1 });

// Ownership state
db[`${prefix}ownership_state`].createIndex({ resource_ref: 1 }, { unique: true });
db[`${prefix}ownership_state`].createIndex({ current_owner_id: 1 });

print("ProvenanceKit MongoDB indexes created.");
