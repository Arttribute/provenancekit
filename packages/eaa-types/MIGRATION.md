# Migration Guide: v1 → v2

This guide helps you upgrade from v1 to v2 of `@provenancekit/eaa-types`.

## Overview

**v2** refactors EAA types to be **pure provenance primitives** with **zero opinions** about payments, weights, or domain logic. All opinionated functionality has been moved to **extensions**.

### Philosophy Change

```
v1: Base types include domain-specific fields
v2: Base types = pure provenance, everything else = extensions
```

---

## Breaking Changes

### 1. Attribution Changes

#### Removed Fields

| v1 Field | v2 Replacement |
|----------|----------------|
| `weight` | Use `ext:contrib@1.0.0` extension |
| `includedInRevenue` | Use `ext:x402@1.0.0` extension |
| `includedInAttribution` | Use `note` field or remove |

#### Migration Example

**Before (v1)**:
```typescript
const attribution: Attribution = {
  resourceCid: "bafy...",
  entityId: "alice",
  role: "creator",
  weight: 7000,
  includedInRevenue: true,
  includedInAttribution: true,
};
```

**After (v2)**:
```typescript
import { Attribution, setExtension } from "@provenancekit/eaa-types";

const attribution: Attribution = {
  resourceCid: "bafy...",
  entityId: "alice",
  role: "creator",
};

// Add weight via extension
setExtension(attribution, "ext:contrib@1.0.0", {
  weight: 7000,
});

// Add payment info via extension
setExtension(attribution, "ext:x402@1.0.0", {
  revenueShare: 7000,
});
```

---

### 2. Resource Changes

#### Removed Fields

| v1 Field | v2 Replacement |
|----------|----------------|
| `license` | Use `ext:licensing@1.0.0` extension |

#### Migration Example

**Before (v1)**:
```typescript
const resource: Resource = {
  address: { cid: "bafy...", size: 1024, algorithm: "sha256" },
  type: "text",
  locations: [{ uri: "ipfs://bafy...", provider: "pinata", verified: true }],
  createdAt: "2025-01-13T10:00:00Z",
  createdBy: "alice",
  rootAction: "action1",
  license: "CC-BY-4.0",
};
```

**After (v2)**:
```typescript
import { Resource, setExtension } from "@provenancekit/eaa-types";

const resource: Resource = {
  address: { cid: "bafy...", size: 1024, algorithm: "sha256" },
  type: "text",
  locations: [{ uri: "ipfs://bafy...", provider: "pinata" }],
  createdAt: "2025-01-13T10:00:00Z",
  createdBy: "alice",
  rootAction: "action1",
};

// Add license via extension
setExtension(resource, "ext:licensing@1.0.0", {
  spdx: "CC-BY-4.0",
  commercial: true,
  attributionRequired: true,
});
```

#### Location Field Changes

The `verified` field has been removed from `Location`. If you need verification status, use extensions.

**Before (v1)**:
```typescript
locations: [{
  uri: "ipfs://bafy...",
  provider: "pinata",
  verified: true
}]
```

**After (v2)**:
```typescript
locations: [{
  uri: "ipfs://bafy...",
  provider: "pinata"
}]

// If verification is critical, use extensions
extensions: {
  "ext:ipfs@1.0.0": {
    verified: true,
    verifiedAt: "2025-01-13T10:00:00Z",
    verifier: "pinata-oracle"
  }
}
```

---

### 3. Action Changes

#### Field Renames

| v1 Field | v2 Field |
|----------|----------|
| `inputCids` | `inputs` |
| `outputCids` | `outputs` |

#### Removed Fields

| v1 Field | v2 Replacement |
|----------|----------------|
| `assignedByEntity` | Use extensions |
| `reviewedByEntity` | Use extensions |
| `reviewOutcome` | Use extensions |
| `toolUsed` | Use extensions |

#### Migration Example

**Before (v1)**:
```typescript
const action: Action = {
  id: "action1",
  type: "review",
  performedBy: "alice",
  timestamp: "2025-01-13T10:00:00Z",
  inputCids: ["bafy1"],
  outputCids: ["bafy2"],
  reviewedByEntity: "bob",
  reviewOutcome: "approved",
  toolUsed: "gpt-4",
};
```

**After (v2)**:
```typescript
import { Action, setExtension } from "@provenancekit/eaa-types";

const action: Action = {
  id: "action1",
  type: "verify", // "review" → "verify"
  performedBy: "alice",
  timestamp: "2025-01-13T10:00:00Z",
  inputs: ["bafy1"],  // renamed from inputCids
  outputs: ["bafy2"], // renamed from outputCids
};

// Add review info via extension
setExtension(action, "ext:review@1.0.0", {
  reviewedBy: "bob",
  outcome: "approved",
  comments: "Looks good!",
});

// Add tool info via extension
setExtension(action, "ext:tool@1.0.0", {
  id: "gpt-4",
  name: "GPT-4",
  version: "turbo-2024-04-09",
});
```

---

### 4. Enum Changes

#### ActionType Simplified

| v1 Value | v2 Value | Notes |
|----------|----------|-------|
| `"create"` | `"create"` | ✅ Unchanged |
| `"remix"` | `"derive"` | ⚠️ Renamed |
| `"train"` | `"ext:ml:train"` | ⚠️ Use extension |
| `"review"` | `"verify"` | ⚠️ Renamed |
| `"assign"` | ❌ Removed | Use extensions |
| `"aggregate"` | `"aggregate"` | ✅ Unchanged |
| `"contribute"` | ❌ Removed | Use extensions |

#### AttributionRole Simplified

| v1 Value | v2 Value | Notes |
|----------|----------|-------|
| `"creator"` | `"creator"` | ✅ Unchanged |
| `"contributor"` | `"contributor"` | ✅ Unchanged |
| `"sourceMaterial"` | `"source"` | ⚠️ Renamed |
| `"reviewer"` | ❌ Removed | Use extensions |

#### ResourceType Simplified

| v1 Value | v2 Value | Notes |
|----------|----------|-------|
| `"text"` | `"text"` | ✅ Unchanged |
| `"image"` | `"image"` | ✅ Unchanged |
| `"audio"` | `"audio"` | ✅ Unchanged |
| `"video"` | `"video"` | ✅ Unchanged |
| `"code"` | `"code"` | ✅ Unchanged |
| `"dataset"` | `"data"` | ⚠️ Renamed |
| `"model"` | `"model"` | ✅ Unchanged |
| `"tool"` | ❌ Removed | Use `"other"` or extensions |
| `"composite"` | ❌ Removed | Use `"other"` or extensions |

---

## Extension System

### Creating Custom Extensions

**Define Extension**:
```typescript
import { z } from "zod";
import { ExtensionDefinition, registry } from "@provenancekit/eaa-types";

const MyExtension: ExtensionDefinition = {
  key: "ext:myorg:feature@1.0.0",
  name: "My Feature",
  extends: "Resource",
  schema: z.object({
    customField: z.string(),
    anotherField: z.number(),
  }),
  description: "Adds custom feature to resources",
  url: "https://docs.myorg.com/extensions/feature",
};

registry.register(MyExtension);
```

**Use Extension**:
```typescript
import { Resource, setExtension, getExtension } from "@provenancekit/eaa-types";

const resource: Resource = { /* ... */ };

// Set extension data
setExtension(resource, "ext:myorg:feature@1.0.0", {
  customField: "value",
  anotherField: 42,
});

// Get extension data
const data = getExtension(resource, "ext:myorg:feature@1.0.0");
console.log(data); // { customField: "value", anotherField: 42 }
```

---

## Common Migration Patterns

### Pattern 1: Track Contribution Weight

**v1**:
```typescript
const attribution: Attribution = {
  resourceCid: "bafy...",
  entityId: "alice",
  role: "creator",
  weight: 6000, // 60%
};
```

**v2**:
```typescript
import { Attribution, setExtension } from "@provenancekit/eaa-types";

const attribution: Attribution = {
  resourceCid: "bafy...",
  entityId: "alice",
  role: "creator",
};

setExtension(attribution, "ext:contrib@1.0.0", {
  weight: 6000, // basis points (0-10000)
  method: "automatic",
});
```

### Pattern 2: Revenue Sharing

**v1**:
```typescript
const attribution: Attribution = {
  resourceCid: "bafy...",
  entityId: "alice",
  role: "creator",
  weight: 7000,
  includedInRevenue: true,
};
```

**v2**:
```typescript
import { Attribution, setExtension } from "@provenancekit/eaa-types";

const attribution: Attribution = {
  resourceCid: "bafy...",
  entityId: "alice",
  role: "creator",
};

setExtension(attribution, "ext:x402@1.0.0", {
  revenueShare: 7000, // basis points
  paymentDestination: {
    method: "wallet",
    address: "0x...",
    network: "base",
  },
});
```

### Pattern 3: Tool Tracking

**v1**:
```typescript
const action: Action = {
  id: "action1",
  type: "create",
  performedBy: "alice",
  timestamp: "2025-01-13T10:00:00Z",
  inputCids: [],
  outputCids: ["bafy..."],
  toolUsed: "gpt-4",
};
```

**v2**:
```typescript
import { Action, setExtension } from "@provenancekit/eaa-types";

const action: Action = {
  id: "action1",
  type: "create",
  performedBy: "alice",
  timestamp: "2025-01-13T10:00:00Z",
  inputs: [],
  outputs: ["bafy..."],
};

setExtension(action, "ext:tool@1.0.0", {
  id: "gpt-4",
  name: "GPT-4",
  version: "turbo-2024-04-09",
  agent: "openai",
});
```

---

## Automated Migration Script

For bulk migrations, use this script:

```typescript
import { Attribution, Resource, Action, setExtension } from "@provenancekit/eaa-types";

function migrateAttribution(oldAttr: any): Attribution {
  const newAttr: Attribution = {
    resourceCid: oldAttr.resourceCid,
    entityId: oldAttr.entityId,
    role: oldAttr.role === "sourceMaterial" ? "source" : oldAttr.role,
    note: oldAttr.note,
  };

  // Migrate weight
  if (oldAttr.weight !== undefined) {
    setExtension(newAttr, "ext:contrib@1.0.0", {
      weight: oldAttr.weight,
    });
  }

  // Migrate revenue
  if (oldAttr.includedInRevenue) {
    setExtension(newAttr, "ext:x402@1.0.0", {
      revenueShare: oldAttr.weight || 10000,
    });
  }

  return newAttr;
}

function migrateResource(oldRes: any): Resource {
  const newRes: Resource = {
    address: oldRes.address,
    type: oldRes.type === "dataset" ? "data" : oldRes.type,
    locations: oldRes.locations.map((loc: any) => ({
      uri: loc.uri,
      provider: loc.provider,
    })),
    createdAt: oldRes.createdAt,
    createdBy: oldRes.createdBy,
    rootAction: oldRes.rootAction,
  };

  // Migrate license
  if (oldRes.license) {
    setExtension(newRes, "ext:licensing@1.0.0", {
      spdx: oldRes.license,
      commercial: true,
      attributionRequired: true,
    });
  }

  return newRes;
}

function migrateAction(oldAct: any): Action {
  const typeMap: Record<string, string> = {
    remix: "derive",
    review: "verify",
    train: "ext:ml:train",
  };

  const newAct: Action = {
    id: oldAct.id,
    type: typeMap[oldAct.type] || oldAct.type,
    performedBy: oldAct.performedBy,
    timestamp: oldAct.timestamp,
    inputs: oldAct.inputCids || [],
    outputs: oldAct.outputCids || [],
    proof: oldAct.proof,
  };

  // Migrate tool
  if (oldAct.toolUsed) {
    setExtension(newAct, "ext:tool@1.0.0", {
      id: oldAct.toolUsed,
      name: oldAct.toolUsed,
    });
  }

  // Migrate review
  if (oldAct.reviewedByEntity || oldAct.reviewOutcome) {
    setExtension(newAct, "ext:review@1.0.0", {
      reviewedBy: oldAct.reviewedByEntity,
      outcome: oldAct.reviewOutcome,
    });
  }

  return newAct;
}
```

---

## Testing Your Migration

After migrating, validate your data:

```typescript
import { ProvenanceBundle, validateExtensions } from "@provenancekit/eaa-types";

const bundle: ProvenanceBundle = { /* ... */ };

// Validate all extensions
for (const attr of bundle.attributions) {
  const errors = validateExtensions(attr);
  if (errors.length > 0) {
    console.error(`Invalid extensions in attribution:`, errors);
  }
}
```

---

## FAQ

### Q: Do I need to migrate immediately?

**A**: v1 types are deprecated but still work. However, we recommend migrating to take advantage of the cleaner, more flexible v2 architecture.

### Q: Can I use both v1 and v2 types?

**A**: No. They are incompatible. Choose one version for your project.

### Q: What if I have custom fields?

**A**: Perfect! Create your own extension:

```typescript
const MyExtension: ExtensionDefinition = {
  key: "ext:myorg:custom@1.0.0",
  name: "My Custom Fields",
  extends: "Attribution",
  schema: z.object({
    myCustomField: z.string(),
  }),
};
```

### Q: Are extensions validated?

**A**: Only if registered. Unregistered extensions are stored but not validated. This allows flexibility for ad-hoc extensions.

---

## Need Help?

- **Documentation**: https://docs.provenancekit.com
- **Discord**: https://discord.gg/provenancekit
- **Issues**: https://github.com/provenancekit/provenancekit/issues
- **Email**: support@provenancekit.com

---

## Summary

✅ **Base types** are now pure provenance primitives
✅ **Extensions** handle domain-specific needs
✅ **Backward compatibility** via migration scripts
✅ **More flexible** and **future-proof**

Welcome to v2! 🚀
