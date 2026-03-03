import { describe, it, expect } from "vitest";
import { cidRef, type Resource, type Action, type Attribution } from "@provenancekit/eaa-types";
import {
  X402_NAMESPACE,
  X402Extension,
  X402Requirements,
  X402Proof,
  X402Split,
  withX402Requirements,
  withX402Proof,
  withX402Split,
  getX402,
  getX402Requirements,
  getX402Proof,
  getX402Split,
  hasX402,
  requiresX402Payment,
  isX402Verified,
  totalX402SplitBps,
} from "../src/x402";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = new Date().toISOString();
const USDC_BASE = { currency: "USDC", network: "base", chainId: 8453 };

function makeResource(cid = "bafytest123"): Resource {
  return {
    address: cidRef(cid),
    type: "image",
    locations: [],
    createdAt: now,
    createdBy: "did:key:alice",
    rootAction: "action-1",
  };
}

function makeAction(): Action {
  return {
    id: "action-1",
    type: "create",
    performedBy: "did:key:alice",
    timestamp: now,
    inputs: [],
    outputs: [cidRef("bafytest123")],
  };
}

function makeAttribution(): Attribution {
  return {
    resourceRef: cidRef("bafytest123"),
    entityId: "did:key:alice",
    role: "creator",
  };
}

// ─── X402 Namespace ───────────────────────────────────────────────────────────

describe("X402_NAMESPACE", () => {
  it("has the correct namespace key", () => {
    expect(X402_NAMESPACE).toBe("ext:x402@1.0.0");
  });
});

// ─── X402Requirements schema ──────────────────────────────────────────────────

describe("X402Requirements schema", () => {
  const valid = {
    amount: "0.001",
    currency: "USDC",
    network: "base",
    chainId: 8453,
    recipient: "0xdeadbeef",
  };

  it("validates a complete requirements object", () => {
    expect(X402Requirements.safeParse(valid).success).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(X402Requirements.safeParse({ amount: "0.001" }).success).toBe(false);
  });

  it("rejects non-positive chainId", () => {
    expect(X402Requirements.safeParse({ ...valid, chainId: 0 }).success).toBe(false);
    expect(X402Requirements.safeParse({ ...valid, chainId: -1 }).success).toBe(false);
  });

  it("accepts optional splitContract", () => {
    const result = X402Requirements.parse({ ...valid, splitContract: "0xsplit" });
    expect(result.splitContract).toBe("0xsplit");
  });

  it("accepts optional expiresAt datetime", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = X402Requirements.parse({ ...valid, expiresAt: future });
    expect(result.expiresAt).toBe(future);
  });

  it("rejects invalid expiresAt format", () => {
    expect(X402Requirements.safeParse({ ...valid, expiresAt: "not-a-date" }).success).toBe(false);
  });
});

// ─── X402Proof schema ─────────────────────────────────────────────────────────

describe("X402Proof schema", () => {
  const valid = {
    paymentTxHash: "0xabc123def456",
    paidAt: now,
  };

  it("validates minimal proof", () => {
    expect(X402Proof.safeParse(valid).success).toBe(true);
  });

  it("defaults verified to false", () => {
    const result = X402Proof.parse(valid);
    expect(result.verified).toBe(false);
  });

  it("accepts verified: true", () => {
    const result = X402Proof.parse({ ...valid, verified: true });
    expect(result.verified).toBe(true);
  });

  it("rejects missing paymentTxHash", () => {
    expect(X402Proof.safeParse({ paidAt: now }).success).toBe(false);
  });

  it("rejects invalid paidAt format", () => {
    expect(X402Proof.safeParse({ paymentTxHash: "0x...", paidAt: "yesterday" }).success).toBe(false);
  });

  it("accepts all optional fields", () => {
    const result = X402Proof.parse({
      ...valid,
      amount: "0.001",
      currency: "USDC",
      chainId: 8453,
      payer: "0xpayer",
      verified: true,
    });
    expect(result.amount).toBe("0.001");
    expect(result.payer).toBe("0xpayer");
  });
});

// ─── X402Split schema ─────────────────────────────────────────────────────────

describe("X402Split schema", () => {
  it("validates split with splitBps", () => {
    expect(X402Split.safeParse({ splitBps: 7000 }).success).toBe(true);
  });

  it("rejects splitBps > 10000", () => {
    expect(X402Split.safeParse({ splitBps: 10001 }).success).toBe(false);
  });

  it("rejects splitBps < 0", () => {
    expect(X402Split.safeParse({ splitBps: -1 }).success).toBe(false);
  });

  it("accepts 0 bps", () => {
    expect(X402Split.safeParse({ splitBps: 0 }).success).toBe(true);
  });

  it("accepts 10000 bps (100%)", () => {
    expect(X402Split.safeParse({ splitBps: 10000 }).success).toBe(true);
  });

  it("accepts optional fields", () => {
    const result = X402Split.parse({
      splitBps: 5000,
      splitContract: "0xsplit",
      chainId: 8453,
      paymentAddress: "0xalice",
      currency: "USDC",
    });
    expect(result.splitContract).toBe("0xsplit");
    expect(result.paymentAddress).toBe("0xalice");
  });
});

// ─── X402Extension schema ─────────────────────────────────────────────────────

describe("X402Extension schema", () => {
  it("validates with requirements only", () => {
    expect(X402Extension.safeParse({
      requirements: {
        amount: "0.001",
        currency: "USDC",
        network: "base",
        chainId: 8453,
        recipient: "0x...",
      },
    }).success).toBe(true);
  });

  it("validates with proof only", () => {
    expect(X402Extension.safeParse({
      proof: { paymentTxHash: "0xabc", paidAt: now },
    }).success).toBe(true);
  });

  it("validates with split only", () => {
    expect(X402Extension.safeParse({
      split: { splitBps: 5000 },
    }).success).toBe(true);
  });

  it("rejects empty object (at least one field required)", () => {
    expect(X402Extension.safeParse({}).success).toBe(false);
  });
});

// ─── withX402Requirements ─────────────────────────────────────────────────────

describe("withX402Requirements", () => {
  it("attaches requirements to a resource", () => {
    const resource = withX402Requirements(makeResource(), {
      amount: "0.001",
      ...USDC_BASE,
      recipient: "0xrecipient",
    });
    expect(resource.extensions?.[X402_NAMESPACE]).toBeDefined();
  });

  it("preserves existing resource fields", () => {
    const resource = makeResource();
    const result = withX402Requirements(resource, {
      amount: "1.00",
      ...USDC_BASE,
      recipient: "0xrecipient",
    });
    expect(result.type).toBe("image");
    expect(result.createdBy).toBe("did:key:alice");
  });

  it("preserves other extensions", () => {
    const resource = {
      ...makeResource(),
      extensions: { "ext:other@1.0.0": { foo: "bar" } },
    };
    const result = withX402Requirements(resource, {
      amount: "1.00",
      ...USDC_BASE,
      recipient: "0xrecipient",
    });
    expect(result.extensions?.["ext:other@1.0.0"]).toEqual({ foo: "bar" });
  });

  it("validates requirements schema", () => {
    expect(() => withX402Requirements(makeResource(), {
      // Missing required fields
      amount: "0.001",
    } as Parameters<typeof withX402Requirements>[1])).toThrow();
  });
});

// ─── withX402Proof ────────────────────────────────────────────────────────────

describe("withX402Proof", () => {
  it("attaches proof to an action", () => {
    const action = withX402Proof(makeAction(), {
      paymentTxHash: "0xabc123",
      paidAt: now,
    });
    expect(action.extensions?.[X402_NAMESPACE]).toBeDefined();
  });

  it("sets proof.verified false by default", () => {
    const action = withX402Proof(makeAction(), {
      paymentTxHash: "0xabc123",
      paidAt: now,
    });
    const x402 = action.extensions![X402_NAMESPACE] as { proof: X402Proof };
    expect(x402.proof.verified).toBe(false);
  });

  it("preserves other extensions on action", () => {
    const action = {
      ...makeAction(),
      extensions: { "ext:ai@1.0.0": { provider: "openai" } },
    };
    const result = withX402Proof(action, {
      paymentTxHash: "0xabc",
      paidAt: now,
    });
    expect(result.extensions?.["ext:ai@1.0.0"]).toBeDefined();
  });
});

// ─── withX402Split ────────────────────────────────────────────────────────────

describe("withX402Split", () => {
  it("attaches split to an attribution", () => {
    const attr = withX402Split(makeAttribution(), { splitBps: 7000 });
    expect(attr.extensions?.[X402_NAMESPACE]).toBeDefined();
  });

  it("stores splitBps correctly", () => {
    const attr = withX402Split(makeAttribution(), {
      splitBps: 7000,
      splitContract: "0xsplit",
    });
    const x402 = attr.extensions![X402_NAMESPACE] as { split: X402Split };
    expect(x402.split.splitBps).toBe(7000);
    expect(x402.split.splitContract).toBe("0xsplit");
  });
});

// ─── getX402 ─────────────────────────────────────────────────────────────────

describe("getX402", () => {
  it("returns undefined when extension not present", () => {
    expect(getX402(makeResource())).toBeUndefined();
  });

  it("returns parsed extension", () => {
    const resource = withX402Requirements(makeResource(), {
      amount: "1.00",
      ...USDC_BASE,
      recipient: "0xrecipient",
    });
    const ext = getX402(resource);
    expect(ext).toBeDefined();
    expect(ext?.requirements?.amount).toBe("1.00");
  });
});

// ─── getX402Requirements ─────────────────────────────────────────────────────

describe("getX402Requirements", () => {
  it("returns requirements from resource", () => {
    const resource = withX402Requirements(makeResource(), {
      amount: "0.50",
      currency: "ETH",
      network: "base",
      chainId: 8453,
      recipient: "0xrecipient",
    });
    const req = getX402Requirements(resource);
    expect(req?.amount).toBe("0.50");
    expect(req?.currency).toBe("ETH");
  });

  it("returns undefined if no requirements", () => {
    expect(getX402Requirements(makeResource())).toBeUndefined();
  });
});

// ─── getX402Proof ─────────────────────────────────────────────────────────────

describe("getX402Proof", () => {
  it("returns proof from action", () => {
    const action = withX402Proof(makeAction(), {
      paymentTxHash: "0xprooftx",
      paidAt: now,
      verified: true,
    });
    const proof = getX402Proof(action);
    expect(proof?.paymentTxHash).toBe("0xprooftx");
    expect(proof?.verified).toBe(true);
  });

  it("returns undefined if no proof", () => {
    expect(getX402Proof(makeAction())).toBeUndefined();
  });
});

// ─── getX402Split ─────────────────────────────────────────────────────────────

describe("getX402Split", () => {
  it("returns split from attribution", () => {
    const attr = withX402Split(makeAttribution(), { splitBps: 3000 });
    expect(getX402Split(attr)?.splitBps).toBe(3000);
  });

  it("returns undefined if no split", () => {
    expect(getX402Split(makeAttribution())).toBeUndefined();
  });
});

// ─── hasX402 ──────────────────────────────────────────────────────────────────

describe("hasX402", () => {
  it("returns false for object without x402 extension", () => {
    expect(hasX402(makeResource())).toBe(false);
  });

  it("returns true after adding x402 extension", () => {
    const resource = withX402Requirements(makeResource(), {
      amount: "1.00",
      ...USDC_BASE,
      recipient: "0xrecipient",
    });
    expect(hasX402(resource)).toBe(true);
  });
});

// ─── requiresX402Payment ─────────────────────────────────────────────────────

describe("requiresX402Payment", () => {
  it("returns false for resource without requirements", () => {
    expect(requiresX402Payment(makeResource())).toBe(false);
  });

  it("returns true for resource with requirements", () => {
    const resource = withX402Requirements(makeResource(), {
      amount: "0.001",
      ...USDC_BASE,
      recipient: "0xrecipient",
    });
    expect(requiresX402Payment(resource)).toBe(true);
  });
});

// ─── isX402Verified ───────────────────────────────────────────────────────────

describe("isX402Verified", () => {
  it("returns false for action without proof", () => {
    expect(isX402Verified(makeAction())).toBe(false);
  });

  it("returns false for unverified proof", () => {
    const action = withX402Proof(makeAction(), {
      paymentTxHash: "0xabc",
      paidAt: now,
      verified: false,
    });
    expect(isX402Verified(action)).toBe(false);
  });

  it("returns true for verified proof", () => {
    const action = withX402Proof(makeAction(), {
      paymentTxHash: "0xabc",
      paidAt: now,
      verified: true,
    });
    expect(isX402Verified(action)).toBe(true);
  });
});

// ─── totalX402SplitBps ────────────────────────────────────────────────────────

describe("totalX402SplitBps", () => {
  it("returns 0 for empty array", () => {
    expect(totalX402SplitBps([])).toBe(0);
  });

  it("returns 0 if no attributions have x402 splits", () => {
    expect(totalX402SplitBps([makeAttribution(), makeAttribution()])).toBe(0);
  });

  it("sums basis points across attributions", () => {
    const alice = withX402Split(makeAttribution(), { splitBps: 7000 });
    const bob = withX402Split(
      { ...makeAttribution(), entityId: "did:key:bob" },
      { splitBps: 2000 }
    );
    const platform = withX402Split(
      { ...makeAttribution(), entityId: "did:key:platform" },
      { splitBps: 1000 }
    );
    expect(totalX402SplitBps([alice, bob, platform])).toBe(10000);
  });

  it("ignores attributions without x402 splits", () => {
    const alice = withX402Split(makeAttribution(), { splitBps: 7000 });
    const bob = makeAttribution(); // no x402
    expect(totalX402SplitBps([alice, bob])).toBe(7000);
  });

  it("validates complete 3-way split (70/20/10)", () => {
    const alice = withX402Split(
      { ...makeAttribution(), entityId: "did:key:alice" },
      { splitBps: 7000 }
    );
    const model = withX402Split(
      { ...makeAttribution(), entityId: "openai" },
      { splitBps: 2000 }
    );
    const platform = withX402Split(
      { ...makeAttribution(), entityId: "platform" },
      { splitBps: 1000 }
    );
    expect(totalX402SplitBps([alice, model, platform])).toBe(10000);
  });
});

// ─── End-to-end: full x402 provenance flow ────────────────────────────────────

describe("x402 full provenance flow", () => {
  it("records complete resource + payment lifecycle", () => {
    // Step 1: Alice creates an image and marks it as payable
    const resource = withX402Requirements(makeResource("bafyimage"), {
      amount: "1.00",
      currency: "USDC",
      network: "base",
      chainId: 8453,
      recipient: "0xsplit-contract",
      splitContract: "0xsplit-contract",
    });

    // Step 2: Bob pays and accesses it
    const accessAction = withX402Proof(
      {
        ...makeAction(),
        id: "access-action-1",
        type: "verify",
        performedBy: "did:key:bob",
      },
      {
        paymentTxHash: "0xpaymenttx",
        amount: "1.00",
        currency: "USDC",
        chainId: 8453,
        paidAt: now,
        verified: true,
        payer: "0xbob-wallet",
      }
    );

    // Step 3: Attribution with splits (70/30)
    const aliceAttr = withX402Split(
      { ...makeAttribution(), entityId: "did:key:alice" },
      {
        splitBps: 7000,
        splitContract: "0xsplit-contract",
        chainId: 8453,
      }
    );
    const platformAttr = withX402Split(
      {
        resourceRef: cidRef("bafyimage"),
        entityId: "platform",
        role: "contributor",
      },
      { splitBps: 3000 }
    );

    // Verify resource has requirements
    expect(requiresX402Payment(resource)).toBe(true);
    const req = getX402Requirements(resource)!;
    expect(req.amount).toBe("1.00");
    expect(req.currency).toBe("USDC");
    expect(req.recipient).toBe("0xsplit-contract");

    // Verify action has verified proof
    expect(isX402Verified(accessAction)).toBe(true);
    const proof = getX402Proof(accessAction)!;
    expect(proof.paymentTxHash).toBe("0xpaymenttx");
    expect(proof.payer).toBe("0xbob-wallet");

    // Verify splits sum to 100%
    expect(totalX402SplitBps([aliceAttr, platformAttr])).toBe(10000);
  });
});
