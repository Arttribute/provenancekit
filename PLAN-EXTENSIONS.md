# @provenancekit/extensions - Implementation Plan

## Overview

The `@provenancekit/extensions` package provides **type-safe schemas and helpers** for common extension patterns. It does NOT provide a registry - EAA already enforces the `ext:namespace` pattern, so anyone can create extensions without registration.

## What This Package Provides

1. **Zod schemas** for common extensions (type safety, validation)
2. **Helper functions** for adding/reading extensions (convenience)
3. **Namespace constants** (avoid typos)

## What This Package Does NOT Provide

- ~~Central registry~~ - Not needed, EAA handles it
- ~~Registration API~~ - Extensions work without registering
- ~~Discovery/listing~~ - Over-engineering

---

## Package Structure

```
packages/provenancekit-extensions/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Main exports
│   ├── contrib.ts               # ext:contrib@1.0.0
│   ├── license.ts               # ext:license@1.0.0
│   ├── payment.ts               # ext:payment@1.0.0
│   ├── onchain.ts               # ext:onchain@1.0.0
│   ├── storage.ts               # ext:storage@1.0.0
│   ├── ai.ts                    # ext:ai@1.0.0
│   └── utils.ts                 # Generic helpers
└── tests/
    ├── contrib.test.ts
    ├── license.test.ts
    └── payment.test.ts
```

---

## Extension Schemas

### ext:contrib@1.0.0 (Contribution Weights)

**Purpose:** Track how much each entity contributed to a resource.

**Used on:** `Attribution`

```typescript
// src/contrib.ts
import { z } from "zod";
import type { Attribution } from "@provenancekit/eaa-types";

export const CONTRIB_NAMESPACE = "ext:contrib@1.0.0" as const;

export const ContribBasis = z.enum(["points", "percentage", "absolute"]);

export const ContribSource = z.enum([
  "self-declared",  // Contributor claimed it
  "agreed",         // All parties agreed
  "calculated",     // Algorithm (git blame, etc.)
  "verified",       // Third-party verified
  "default",        // System default
]);

export const ContribExtension = z.object({
  /** Weight value (interpretation depends on basis) */
  weight: z.number().min(0),

  /** How to interpret weight. Default: "points" (basis points, 6000 = 60%) */
  basis: ContribBasis.default("points"),

  /** How this weight was determined */
  source: ContribSource.optional(),

  /** Who verified (Entity.id) */
  verifiedBy: z.string().optional(),

  /** When verified */
  verifiedAt: z.string().datetime().optional(),

  /** Category of contribution */
  category: z.string().optional(),

  /** Human-readable note */
  note: z.string().optional(),
});

export type ContribExtension = z.infer<typeof ContribExtension>;

// Helpers
export function withContrib(
  attr: Attribution,
  contrib: z.input<typeof ContribExtension>
): Attribution {
  const validated = ContribExtension.parse(contrib);
  return {
    ...attr,
    extensions: { ...attr.extensions, [CONTRIB_NAMESPACE]: validated },
  };
}

export function getContrib(attr: Attribution): ContribExtension | undefined {
  const data = attr.extensions?.[CONTRIB_NAMESPACE];
  if (!data) return undefined;
  return ContribExtension.parse(data);
}

export function hasContrib(attr: Attribution): boolean {
  return attr.extensions?.[CONTRIB_NAMESPACE] !== undefined;
}

/** Get weight normalized to basis points (0-10000) */
export function getContribBps(attr: Attribution): number {
  const contrib = getContrib(attr);
  if (!contrib) return 0;

  switch (contrib.basis) {
    case "points": return contrib.weight;
    case "percentage": return contrib.weight * 100;
    case "absolute": return contrib.weight;
  }
}
```

### ext:license@1.0.0 (Licensing Terms)

**Purpose:** Define usage rights for content.

**Used on:** `Resource`, `Attribution`

```typescript
// src/license.ts
import { z } from "zod";
import type { Resource, Attribution } from "@provenancekit/eaa-types";

export const LICENSE_NAMESPACE = "ext:license@1.0.0" as const;

export const LicenseExtension = z.object({
  /** License identifier (SPDX or custom) */
  type: z.string(),

  /** Commercial use allowed? */
  commercial: z.boolean().optional(),

  /** Derivative works allowed? */
  derivatives: z.boolean().optional(),

  /** ShareAlike required? */
  shareAlike: z.boolean().optional(),

  /** Attribution requirement */
  attribution: z.enum(["required", "requested", "none"]).optional(),

  /** Specific attribution text */
  attributionText: z.string().optional(),

  /** URL to full terms */
  termsUrl: z.string().url().optional(),

  /** Geographic jurisdiction */
  jurisdiction: z.string().optional(),

  /** Expiration date */
  expires: z.string().datetime().optional(),
});

export type LicenseExtension = z.infer<typeof LicenseExtension>;

// Helpers
export function withLicense<T extends Resource | Attribution>(
  obj: T,
  license: z.input<typeof LicenseExtension>
): T {
  const validated = LicenseExtension.parse(license);
  return {
    ...obj,
    extensions: { ...obj.extensions, [LICENSE_NAMESPACE]: validated },
  };
}

export function getLicense(obj: Resource | Attribution): LicenseExtension | undefined {
  const data = obj.extensions?.[LICENSE_NAMESPACE];
  if (!data) return undefined;
  return LicenseExtension.parse(data);
}

// Common license presets
export const Licenses = {
  CC0: { type: "CC0-1.0", commercial: true, derivatives: true, attribution: "none" },
  CC_BY: { type: "CC-BY-4.0", commercial: true, derivatives: true, attribution: "required" },
  CC_BY_SA: { type: "CC-BY-SA-4.0", commercial: true, derivatives: true, shareAlike: true, attribution: "required" },
  CC_BY_NC: { type: "CC-BY-NC-4.0", commercial: false, derivatives: true, attribution: "required" },
  MIT: { type: "MIT", commercial: true, derivatives: true, attribution: "required" },
  PROPRIETARY: { type: "proprietary", commercial: false, derivatives: false },
} as const;
```

### ext:payment@1.0.0 (Payment Configuration)

**Purpose:** Configure payment info for revenue distribution.

**Used on:** `Attribution`, `Action`

```typescript
// src/payment.ts
import { z } from "zod";
import type { Attribution, Action } from "@provenancekit/eaa-types";

export const PAYMENT_NAMESPACE = "ext:payment@1.0.0" as const;

export const PaymentMethod = z.enum([
  "superfluid",  // Real-time streaming
  "x402",        // HTTP micropayments
  "splits",      // 0xSplits
  "direct",      // Direct transfer
  "manual",      // Off-chain
]);

export const PaymentRecipient = z.object({
  address: z.string(),
  chainId: z.number().optional(),
  ensName: z.string().optional(),
});

export const PaymentExtension = z.object({
  /** Payment recipient */
  recipient: PaymentRecipient,

  /** Preferred payment method */
  method: PaymentMethod.optional(),

  /** Currency/token (USDC, ETH, USDCx) */
  currency: z.string().optional(),

  /** Split in basis points (6000 = 60%) */
  splitBps: z.number().min(0).max(10000).optional(),

  /** Minimum amount to trigger payment */
  minAmount: z.string().optional(),

  /** Superfluid: minimum flow rate */
  minFlowRate: z.string().optional(),

  /** x402: price per access */
  pricePerAccess: z.string().optional(),
});

export type PaymentExtension = z.infer<typeof PaymentExtension>;

// Helpers
export function withPayment<T extends Attribution | Action>(
  obj: T,
  payment: z.input<typeof PaymentExtension>
): T {
  const validated = PaymentExtension.parse(payment);
  return {
    ...obj,
    extensions: { ...obj.extensions, [PAYMENT_NAMESPACE]: validated },
  };
}

export function getPayment(obj: Attribution | Action): PaymentExtension | undefined {
  const data = obj.extensions?.[PAYMENT_NAMESPACE];
  if (!data) return undefined;
  return PaymentExtension.parse(data);
}
```

### ext:onchain@1.0.0 (Blockchain Proof)

**Purpose:** Store blockchain anchoring data. Added by indexer.

**Used on:** `Action`, `Resource`, `Attribution`

```typescript
// src/onchain.ts
import { z } from "zod";

export const ONCHAIN_NAMESPACE = "ext:onchain@1.0.0" as const;

export const OnchainExtension = z.object({
  chainId: z.number(),
  chainName: z.string().optional(),
  blockNumber: z.number(),
  blockTimestamp: z.string().datetime().optional(),
  transactionHash: z.string(),
  logIndex: z.number().optional(),
  contractAddress: z.string().optional(),
  confirmed: z.boolean().optional(),
});

export type OnchainExtension = z.infer<typeof OnchainExtension>;

// Generic helpers (works on any object with extensions)
export function withOnchain<T extends { extensions?: Record<string, unknown> }>(
  obj: T,
  onchain: z.input<typeof OnchainExtension>
): T {
  const validated = OnchainExtension.parse(onchain);
  return {
    ...obj,
    extensions: { ...obj.extensions, [ONCHAIN_NAMESPACE]: validated },
  };
}

export function getOnchain(obj: { extensions?: Record<string, unknown> }): OnchainExtension | undefined {
  const data = obj.extensions?.[ONCHAIN_NAMESPACE];
  if (!data) return undefined;
  return OnchainExtension.parse(data);
}
```

### ext:storage@1.0.0 (Storage Metadata)

**Purpose:** Track storage/replication status.

**Used on:** `Resource`

```typescript
// src/storage.ts
import { z } from "zod";
import type { Resource } from "@provenancekit/eaa-types";

export const STORAGE_NAMESPACE = "ext:storage@1.0.0" as const;

export const StorageReplica = z.object({
  provider: z.string(),
  status: z.enum(["pending", "active", "failed", "expired"]),
  region: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const StorageExtension = z.object({
  pinned: z.boolean().optional(),
  replicas: z.array(StorageReplica).optional(),
  totalSize: z.number().optional(),
  encrypted: z.boolean().optional(),
  contentType: z.string().optional(),
  lastVerified: z.string().datetime().optional(),
});

export type StorageExtension = z.infer<typeof StorageExtension>;

export function withStorage(
  resource: Resource,
  storage: z.input<typeof StorageExtension>
): Resource {
  const validated = StorageExtension.parse(storage);
  return {
    ...resource,
    extensions: { ...resource.extensions, [STORAGE_NAMESPACE]: validated },
  };
}

export function getStorage(resource: Resource): StorageExtension | undefined {
  const data = resource.extensions?.[STORAGE_NAMESPACE];
  if (!data) return undefined;
  return StorageExtension.parse(data);
}
```

### ext:ai@1.0.0 (AI Metadata)

**Purpose:** Track AI model/generation info.

**Used on:** `Entity` (for AI agents), `Action` (for generations)

```typescript
// src/ai.ts
import { z } from "zod";
import type { Entity, Action } from "@provenancekit/eaa-types";

export const AI_NAMESPACE = "ext:ai@1.0.0" as const;

// For Entity (describing the AI system)
export const AIEntityExtension = z.object({
  provider: z.string(),
  model: z.string(),
  version: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
});

// For Action (describing the generation)
export const AIActionExtension = z.object({
  prompt: z.string().optional(),
  promptHash: z.string().optional(),
  systemPrompt: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
  tokensUsed: z.number().optional(),
  generationTime: z.number().optional(),
  seed: z.number().optional(),
});

export type AIEntityExtension = z.infer<typeof AIEntityExtension>;
export type AIActionExtension = z.infer<typeof AIActionExtension>;

export function withAIEntity(
  entity: Entity,
  ai: z.input<typeof AIEntityExtension>
): Entity {
  const validated = AIEntityExtension.parse(ai);
  return {
    ...entity,
    extensions: { ...entity.extensions, [AI_NAMESPACE]: validated },
  };
}

export function withAIAction(
  action: Action,
  ai: z.input<typeof AIActionExtension>
): Action {
  const validated = AIActionExtension.parse(ai);
  return {
    ...action,
    extensions: { ...action.extensions, [AI_NAMESPACE]: validated },
  };
}
```

---

## Generic Utilities

```typescript
// src/utils.ts

/**
 * Add any extension to any object with extensions.
 */
export function withExtension<T extends { extensions?: Record<string, unknown> }>(
  obj: T,
  namespace: string,
  data: unknown
): T {
  return {
    ...obj,
    extensions: { ...obj.extensions, [namespace]: data },
  };
}

/**
 * Get extension data (untyped).
 */
export function getExtension<E = unknown>(
  obj: { extensions?: Record<string, unknown> },
  namespace: string
): E | undefined {
  return obj.extensions?.[namespace] as E | undefined;
}

/**
 * Check if extension exists.
 */
export function hasExtension(
  obj: { extensions?: Record<string, unknown> },
  namespace: string
): boolean {
  return obj.extensions?.[namespace] !== undefined;
}

/**
 * Remove extension.
 */
export function withoutExtension<T extends { extensions?: Record<string, unknown> }>(
  obj: T,
  namespace: string
): T {
  if (!obj.extensions || !(namespace in obj.extensions)) return obj;
  const { [namespace]: _, ...rest } = obj.extensions;
  return { ...obj, extensions: rest };
}
```

---

## Distribution Calculator

```typescript
// src/distribution.ts
import type { Attribution, ContentReference } from "@provenancekit/eaa-types";
import { getContribBps } from "./contrib";
import { getPayment, type PaymentExtension } from "./payment";

export interface DistributionEntry {
  entityId: string;
  bps: number;
  payment?: PaymentExtension;
}

export interface Distribution {
  resourceRef: ContentReference;
  entries: DistributionEntry[];
  totalBps: number;
}

/**
 * Calculate distribution from attributions.
 */
export function calculateDistribution(
  resourceRef: ContentReference,
  attributions: Attribution[]
): Distribution {
  // Filter to relevant attributions
  const relevant = attributions.filter(
    a => a.resourceRef?.ref === resourceRef.ref
  );

  // Build entries
  const entries: DistributionEntry[] = relevant.map(attr => ({
    entityId: attr.entityId,
    bps: getContribBps(attr),
    payment: getPayment(attr),
  }));

  // Calculate total
  const totalBps = entries.reduce((sum, e) => sum + e.bps, 0);

  // Normalize if not 10000
  const normalized = totalBps === 10000 || totalBps === 0
    ? entries
    : entries.map(e => ({
        ...e,
        bps: Math.round((e.bps / totalBps) * 10000),
      }));

  return {
    resourceRef,
    entries: normalized,
    totalBps: totalBps === 0 ? 0 : 10000,
  };
}

/**
 * Normalize attributions so weights sum to 10000 bps.
 */
export function normalizeContributions(
  attributions: Attribution[]
): Attribution[] {
  const total = attributions.reduce((sum, a) => sum + getContribBps(a), 0);
  if (total === 0 || total === 10000) return attributions;

  return attributions.map(attr => {
    const currentBps = getContribBps(attr);
    const normalizedBps = Math.round((currentBps / total) * 10000);

    return {
      ...attr,
      extensions: {
        ...attr.extensions,
        "ext:contrib@1.0.0": {
          weight: normalizedBps,
          basis: "points",
        },
      },
    };
  });
}
```

---

## Main Exports

```typescript
// src/index.ts

// Contrib
export {
  CONTRIB_NAMESPACE,
  ContribExtension,
  ContribBasis,
  ContribSource,
  withContrib,
  getContrib,
  hasContrib,
  getContribBps,
} from "./contrib";

// License
export {
  LICENSE_NAMESPACE,
  LicenseExtension,
  withLicense,
  getLicense,
  Licenses,
} from "./license";

// Payment
export {
  PAYMENT_NAMESPACE,
  PaymentExtension,
  PaymentMethod,
  PaymentRecipient,
  withPayment,
  getPayment,
} from "./payment";

// Onchain
export {
  ONCHAIN_NAMESPACE,
  OnchainExtension,
  withOnchain,
  getOnchain,
} from "./onchain";

// Storage
export {
  STORAGE_NAMESPACE,
  StorageExtension,
  StorageReplica,
  withStorage,
  getStorage,
} from "./storage";

// AI
export {
  AI_NAMESPACE,
  AIEntityExtension,
  AIActionExtension,
  withAIEntity,
  withAIAction,
} from "./ai";

// Utils
export {
  withExtension,
  getExtension,
  hasExtension,
  withoutExtension,
} from "./utils";

// Distribution
export {
  calculateDistribution,
  normalizeContributions,
  type Distribution,
  type DistributionEntry,
} from "./distribution";
```

---

## Usage Examples

### Basic Usage

```typescript
import { Attribution, cidRef } from "@provenancekit/eaa-types";
import { withContrib, withLicense, withPayment, Licenses } from "@provenancekit/extensions";

// Create attribution with extensions
let attribution: Attribution = {
  resourceRef: cidRef("bafyabc..."),
  entityId: "did:key:alice",
  role: "creator",
};

// Add contribution (60%)
attribution = withContrib(attribution, {
  weight: 6000,
  basis: "points",
  source: "agreed",
});

// Add license
attribution = withLicense(attribution, Licenses.CC_BY);

// Add payment info
attribution = withPayment(attribution, {
  recipient: { address: "0x...", chainId: 8453 },
  method: "superfluid",
  currency: "USDCx",
});
```

### Calculate Distribution

```typescript
import { calculateDistribution } from "@provenancekit/extensions";

const attributions = [
  withContrib(attr1, { weight: 6000 }), // Alice: 60%
  withContrib(attr2, { weight: 3000 }), // Bob: 30%
  withContrib(attr3, { weight: 1000 }), // Carol: 10%
];

const distribution = calculateDistribution(cidRef("bafy..."), attributions);
// {
//   entries: [
//     { entityId: "alice", bps: 6000, payment: {...} },
//     { entityId: "bob", bps: 3000, payment: {...} },
//     { entityId: "carol", bps: 1000, payment: {...} },
//   ],
//   totalBps: 10000
// }
```

### Custom Extensions (No Package Needed)

```typescript
// Anyone can create their own extension - no registration required
const attribution = {
  resourceRef: cidRef("bafy..."),
  entityId: "alice",
  role: "creator",
  extensions: {
    // Custom extension - just use ext: prefix
    "ext:mycompany:audit@1.0.0": {
      auditId: "123",
      auditor: "bob",
      passed: true,
    },
  },
};
```

---

## Implementation Tasks

- [ ] Create package directory structure
- [ ] Set up package.json with dependencies
- [ ] Implement contrib.ts (schema + helpers)
- [ ] Implement license.ts (schema + helpers + presets)
- [ ] Implement payment.ts (schema + helpers)
- [ ] Implement onchain.ts (schema + helpers)
- [ ] Implement storage.ts (schema + helpers)
- [ ] Implement ai.ts (schemas + helpers)
- [ ] Implement utils.ts (generic helpers)
- [ ] Implement distribution.ts (calculator)
- [ ] Write tests for all schemas
- [ ] Write tests for distribution calculator
- [ ] Add JSDoc documentation
- [ ] Create README with examples

---

## Dependencies

```json
{
  "name": "@provenancekit/extensions",
  "version": "0.1.0",
  "dependencies": {
    "zod": "^3.22.0"
  },
  "peerDependencies": {
    "@provenancekit/eaa-types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```
