# @arttribute/eaa-types

**Pure provenance primitives for Human-AI collaborative works**

[![Version](https://img.shields.io/npm/v/@arttribute/eaa-types)](https://www.npmjs.com/package/@arttribute/eaa-types)
[![License](https://img.shields.io/npm/l/@arttribute/eaa-types)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

Entity-Action-Attribution (EAA) type definitions and Zod schemas for tracking provenance of AI-generated and human-created content.

---

## Features

✨ **Pure Provenance** - Base types focus only on traceability (who, what, when)
🔌 **Extensible** - Domain-specific functionality via extensions
🛡️ **Type-Safe** - Full TypeScript + Zod validation
🌐 **W3C PROV Compatible** - Maps cleanly to established standards
📦 **Content-Addressed** - IPFS CIDs for immutable references
🎯 **Zero Opinions** - No built-in payments, weights, or domain logic

---

## Installation

```bash
npm install @arttribute/eaa-types
# or
pnpm add @arttribute/eaa-types
# or
yarn add @arttribute/eaa-types
```

---

## Quick Start

```typescript
import {
  Entity,
  Resource,
  Action,
  Attribution,
  ProvenanceBundle
} from "@arttribute/eaa-types";

// 1. Define entities (who)
const human: Entity = {
  id: "did:key:alice123",
  name: "Alice",
  role: "human",
};

const ai: Entity = {
  id: "did:key:gpt4",
  name: "GPT-4",
  role: "ai",
};

// 2. Define an action (what happened)
const action: Action = {
  id: "action-001",
  type: "create",
  performedBy: human.id,
  timestamp: "2025-01-13T10:00:00Z",
  inputs: [],
  outputs: ["bafy...123"],
};

// 3. Define the resource (output)
const resource: Resource = {
  address: {
    cid: "bafy...123",
    size: 1024,
    algorithm: "sha256"
  },
  type: "text",
  locations: [{
    uri: "ipfs://bafy...123",
    provider: "pinata"
  }],
  createdAt: "2025-01-13T10:00:00Z",
  createdBy: human.id,
  rootAction: action.id,
};

// 4. Define attributions (who gets credit)
const attributions: Attribution[] = [
  {
    resourceCid: resource.address.cid,
    entityId: human.id,
    role: "creator",
    note: "Wrote the initial prompt",
  },
  {
    resourceCid: resource.address.cid,
    entityId: ai.id,
    role: "contributor",
    note: "Generated the content",
  },
];

// 5. Bundle it all together
const bundle: ProvenanceBundle = {
  context: "https://provenancekit.org/context/v1",
  entities: [human, ai],
  resources: [resource],
  actions: [action],
  attributions: attributions,
};
```

---

## Core Types

### Entity (Who)

An agent that performs actions - human, AI, or organization.

```typescript
const entity: Entity = {
  id: string,           // Unique identifier (DID, wallet, UUID)
  name?: string,        // Human-readable name
  role: EntityRole,     // "human" | "ai" | "organization" | "ext:custom"
  publicKey?: string,   // For signature verification
  metadata?: object,    // Arbitrary metadata
  extensions?: object,  // Extension data
};
```

### Resource (What)

A content-addressed artifact with provenance.

```typescript
const resource: Resource = {
  address: {
    cid: string,        // IPFS CID
    size: number,       // Bytes
    algorithm: string,  // "sha256" | "blake3"
  },
  type: ResourceType,   // "text" | "image" | "audio" | etc.
  locations: [          // Where to access
    { uri: string, provider?: string }
  ],
  createdAt: string,    // ISO 8601 timestamp
  createdBy: string,    // Entity.id
  rootAction: string,   // Action.id
  extensions?: object,  // Extension data
};
```

### Action (What Happened)

An activity that transforms inputs into outputs.

```typescript
const action: Action = {
  id: string,           // Unique identifier
  type: ActionType,     // "create" | "derive" | "aggregate" | "verify"
  performedBy: string,  // Entity.id
  timestamp: string,    // ISO 8601
  inputs: string[],     // Input CIDs
  outputs: string[],    // Output CIDs
  proof?: string,       // Signature or tx hash
  extensions?: object,  // Extension data
};
```

### Attribution (Who Gets Credit)

Links an entity to a resource they helped create.

```typescript
const attribution: Attribution = {
  resourceCid: string,  // Resource CID
  entityId: string,     // Entity.id
  role: string,         // "creator" | "contributor" | "source"
  note?: string,        // Explanation
  extensions?: object,  // Extension data (weights, payments, etc.)
};
```

---

## Extension System

Base types are minimal. Add domain-specific functionality via extensions.

### Using Extensions

```typescript
import {
  Entity,
  setExtension,
  getExtension,
  hasExtension
} from "@arttribute/eaa-types";

const entity: Entity = {
  id: "alice",
  name: "Alice",
  role: "human",
};

// Set extension data
setExtension(entity, "ext:x402@1.0.0", {
  wallet: "0x...",
  network: "base",
});

// Get extension data
const payment = getExtension(entity, "ext:x402@1.0.0");

// Check if extension exists
if (hasExtension(entity, "ext:x402@1.0.0")) {
  // ...
}
```

### Creating Extensions

```typescript
import { z } from "zod";
import { ExtensionDefinition, registry } from "@arttribute/eaa-types";

// 1. Define extension schema
const PaymentExtension: ExtensionDefinition = {
  key: "ext:x402@1.0.0",
  name: "x402 Payment",
  extends: "Entity",
  schema: z.object({
    wallet: z.string(),
    network: z.string(),
  }),
  description: "Payment destination for entities",
  url: "https://docs.x402.org",
};

// 2. Register extension
registry.register(PaymentExtension);

// 3. Use it
const entity: Entity = { /* ... */ };
setExtension(entity, "ext:x402@1.0.0", {
  wallet: "0x...",
  network: "base",
});
```

---

## Built-in Extensions

| Extension | Purpose | Package |
|-----------|---------|---------|
| `ext:x402@1.0.0` | Payment distribution | `@provenancekit/extension-x402` |
| `ext:contrib@1.0.0` | Contribution weights | `@provenancekit/extension-contrib` |
| `ext:licensing@1.0.0` | License terms | `@provenancekit/extension-licensing` |
| `ext:temporal@1.0.0` | Time precision | `@provenancekit/extension-temporal` |
| `ext:tool@1.0.0` | Tool tracking | `@provenancekit/extension-tool` |
| `ext:review@1.0.0` | Review workflow | `@provenancekit/extension-review` |

---

## W3C PROV Compatibility

EAA types map directly to W3C PROV:

| EAA | W3C PROV | Purpose |
|-----|----------|---------|
| `Entity` | `Agent` | Who performs actions |
| `Resource` | `Entity` | What gets created |
| `Action` | `Activity` | What happened |
| `Attribution` | `Attribution` | Who gets credit |

---

## Examples

### Example 1: AI Image Generation

```typescript
import { Entity, Resource, Action, Attribution } from "@arttribute/eaa-types";

// Human provides prompt
const human: Entity = {
  id: "alice",
  name: "Alice",
  role: "human",
};

// AI generates image
const ai: Entity = {
  id: "dall-e-3",
  name: "DALL-E 3",
  role: "ai",
};

// Action: create image
const action: Action = {
  id: "gen-001",
  type: "create",
  performedBy: human.id,
  timestamp: new Date().toISOString(),
  inputs: [],
  outputs: ["bafy...image"],
};

// Resource: the image
const image: Resource = {
  address: { cid: "bafy...image", size: 524288, algorithm: "sha256" },
  type: "image",
  locations: [{ uri: "ipfs://bafy...image", provider: "pinata" }],
  createdAt: action.timestamp,
  createdBy: human.id,
  rootAction: action.id,
};

// Attributions
const attrs: Attribution[] = [
  { resourceCid: image.address.cid, entityId: human.id, role: "creator" },
  { resourceCid: image.address.cid, entityId: ai.id, role: "contributor" },
];
```

### Example 2: Dataset Transformation

```typescript
// Load dataset
const loadAction: Action = {
  id: "load-001",
  type: "create",
  performedBy: "alice",
  timestamp: new Date().toISOString(),
  inputs: [],
  outputs: ["bafy...raw"],
};

// Clean dataset
const cleanAction: Action = {
  id: "clean-001",
  type: "derive",
  performedBy: "alice",
  timestamp: new Date().toISOString(),
  inputs: ["bafy...raw"],
  outputs: ["bafy...clean"],
};

// Split dataset
const splitAction: Action = {
  id: "split-001",
  type: "aggregate",
  performedBy: "alice",
  timestamp: new Date().toISOString(),
  inputs: ["bafy...clean"],
  outputs: ["bafy...train", "bafy...test"],
};
```

---

## API Reference

### Extension Helpers

```typescript
// Get extension data
function getExtension<T>(obj: Extensible, key: string): T | undefined;

// Set extension data
function setExtension<T>(obj: Extensible, key: string, data: T): void;

// Check if extension exists
function hasExtension(obj: Extensible, key: string): boolean;

// Remove extension
function removeExtension(obj: Extensible, key: string): boolean;

// Get all extension keys
function getExtensionKeys(obj: Extensible): string[];

// Validate extensions
function validateExtensions(obj: Extensible): Array<{ key: string; error: z.ZodError }>;
```

### Extension Registry

```typescript
// Register extension
registry.register(def: ExtensionDefinition): void;

// Get extension definition
registry.get(key: string): ExtensionDefinition | undefined;

// Get all extensions for a type
registry.forType(type: "Entity" | "Resource" | "Action" | "Attribution"): ExtensionDefinition[];

// Validate data against schema
registry.validate(key: string, data: unknown): boolean;

// Get latest version
registry.latest(namespace: string): ExtensionDefinition | undefined;
```

---

## Migration from v1

See [MIGRATION.md](./MIGRATION.md) for detailed upgrade guide.

**Key Changes**:
- `weight` → Use `ext:contrib@1.0.0`
- `includedInRevenue` → Use `ext:x402@1.0.0`
- `license` → Use `ext:licensing@1.0.0`
- `toolUsed` → Use `ext:tool@1.0.0`
- `inputCids` → `inputs`
- `outputCids` → `outputs`

---

## TypeScript

Full TypeScript support with strict type checking.

```typescript
import type {
  Entity,
  EntityRole,
  Resource,
  ResourceType,
  Action,
  ActionType,
  Attribution,
  ProvenanceBundle
} from "@arttribute/eaa-types";
```

---

## Zod Validation

All types include Zod schemas for runtime validation.

```typescript
import { Entity, Resource, Action } from "@arttribute/eaa-types";

// Validate at runtime
const result = Entity.safeParse(data);
if (result.success) {
  const entity = result.data;
} else {
  console.error(result.error);
}
```

---

## Related Packages

- **[@provenancekit/sdk](../provenancekit-sdk)** - Client SDK for ProvenanceKit API
- **[@provenancekit/extension-x402](../provenancekit-extension-x402)** - Payment distribution
- **[@provenancekit/extension-contrib](../provenancekit-extension-contrib)** - Contribution tracking
- **[@provenancekit/prov](../provenancekit-prov)** - W3C PROV conversion

---

## Philosophy

> **Base types = Pure provenance**
>
> Everything else = Extensions

ProvenanceKit provides minimal, opinion-free primitives for tracking provenance. Domain-specific concerns (payments, weights, licensing) are handled by extensions, keeping the core clean and universal.

---

## License

MIT © [ProvenanceKit](https://provenancekit.org)

---

## Links

- **Documentation**: https://docs.provenancekit.org
- **GitHub**: https://github.com/provenancekit/provenancekit
- **Discord**: https://discord.gg/provenancekit
- **Website**: https://provenancekit.org
