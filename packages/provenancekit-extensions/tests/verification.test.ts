import { describe, it, expect } from "vitest";
import type { Action } from "@provenancekit/eaa-types";
import {
  VERIFICATION_NAMESPACE,
  ClaimStatus,
  VerificationExtension,
  withVerification,
  getVerification,
  isFullyVerified,
} from "../src/verification";

const createAction = (): Action => ({
  id: "action-1",
  type: "create",
  performedBy: "did:key:alice",
  timestamp: "2025-01-15T10:00:00Z",
  inputs: [],
  outputs: [],
});

const baseVerification = {
  status: "verified" as const,
  claims: {
    identity: { status: "verified" as const, detail: "key-ownership" },
    action: { status: "verified" as const, detail: "Ed25519 signature valid" },
    output: { status: "verified" as const, detail: "server witness present" },
  },
  verifiedAt: "2025-01-15T10:00:00Z",
  policyUsed: "enforce" as const,
};

describe("ClaimStatus", () => {
  it("accepts all valid statuses", () => {
    for (const s of ["verified", "receipt-backed", "unverified", "failed", "skipped"]) {
      expect(ClaimStatus.safeParse(s).success).toBe(true);
    }
  });

  it("rejects unknown status", () => {
    expect(ClaimStatus.safeParse("pending").success).toBe(false);
  });
});

describe("VerificationExtension schema", () => {
  it("validates minimal verification (no optional claims)", () => {
    const result = VerificationExtension.safeParse(baseVerification);
    expect(result.success).toBe(true);
  });

  it("validates verification with tool claim", () => {
    const result = VerificationExtension.safeParse({
      ...baseVerification,
      claims: {
        ...baseVerification.claims,
        tool: { status: "receipt-backed", detail: "API receipt included" },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.claims.tool?.status).toBe("receipt-backed");
    }
  });

  it("validates verification with inputs claim", () => {
    const result = VerificationExtension.safeParse({
      ...baseVerification,
      claims: {
        ...baseVerification.claims,
        inputs: { status: "verified", detail: "2/2 inputs exist" },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.claims.inputs?.detail).toBe("2/2 inputs exist");
    }
  });

  it("validates verification with attestation claim", () => {
    const result = VerificationExtension.safeParse({
      ...baseVerification,
      claims: {
        ...baseVerification.claims,
        attestation: { status: "verified", detail: "aws-nitro attestation attached" },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.claims.attestation?.status).toBe("verified");
      expect(result.data.claims.attestation?.detail).toBe("aws-nitro attestation attached");
    }
  });

  it("validates full verification with all optional claims", () => {
    const result = VerificationExtension.safeParse({
      ...baseVerification,
      status: "verified",
      claims: {
        ...baseVerification.claims,
        tool: { status: "verified", detail: "provider-signed" },
        inputs: { status: "verified", detail: "3/3 inputs exist" },
        attestation: { status: "verified", detail: "intel-sgx attestation attached" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("validates partial status", () => {
    const result = VerificationExtension.safeParse({
      ...baseVerification,
      status: "partial",
      claims: {
        ...baseVerification.claims,
        action: { status: "unverified", detail: "no proof provided" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("validates skipped status", () => {
    const result = VerificationExtension.safeParse({
      ...baseVerification,
      status: "skipped",
      policyUsed: "off",
      claims: {
        identity: { status: "skipped" },
        action: { status: "skipped" },
        output: { status: "skipped" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid overall status", () => {
    const result = VerificationExtension.safeParse({
      ...baseVerification,
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("requires identity, action, output claims", () => {
    const result = VerificationExtension.safeParse({
      ...baseVerification,
      claims: { identity: { status: "verified" } },
    });
    expect(result.success).toBe(false);
  });

  it("requires verifiedAt in ISO 8601 format", () => {
    const result = VerificationExtension.safeParse({
      ...baseVerification,
      verifiedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("requires valid policyUsed", () => {
    const result = VerificationExtension.safeParse({
      ...baseVerification,
      policyUsed: "strict",
    });
    expect(result.success).toBe(false);
  });
});

describe("withVerification", () => {
  it("adds verification extension to action", () => {
    const action = createAction();
    const result = withVerification(action, baseVerification);
    expect(result.extensions?.[VERIFICATION_NAMESPACE]).toBeDefined();
    expect(result.id).toBe("action-1");
  });

  it("adds verification with attestation claim", () => {
    const action = createAction();
    const result = withVerification(action, {
      ...baseVerification,
      claims: {
        ...baseVerification.claims,
        attestation: { status: "verified", detail: "aws-nitro attestation attached" },
      },
    });
    const ver = result.extensions?.[VERIFICATION_NAMESPACE] as Record<string, unknown>;
    const claims = ver?.claims as Record<string, unknown>;
    expect((claims?.attestation as Record<string, unknown>)?.status).toBe("verified");
  });

  it("preserves existing extensions", () => {
    const action: Action = {
      ...createAction(),
      extensions: { "ext:other@1.0.0": { foo: "bar" } },
    };
    const result = withVerification(action, baseVerification);
    expect(result.extensions?.[VERIFICATION_NAMESPACE]).toBeDefined();
    expect(result.extensions?.["ext:other@1.0.0"]).toEqual({ foo: "bar" });
  });
});

describe("getVerification", () => {
  it("returns verification data when present", () => {
    const action = withVerification(createAction(), baseVerification);
    const ver = getVerification(action);
    expect(ver?.status).toBe("verified");
    expect(ver?.policyUsed).toBe("enforce");
    expect(ver?.claims.identity.status).toBe("verified");
  });

  it("returns attestation claim intact", () => {
    const action = withVerification(createAction(), {
      ...baseVerification,
      claims: {
        ...baseVerification.claims,
        attestation: { status: "failed", detail: "attestation service unavailable" },
      },
    });
    const ver = getVerification(action);
    expect(ver?.claims.attestation?.status).toBe("failed");
    expect(ver?.claims.attestation?.detail).toBe("attestation service unavailable");
  });

  it("returns undefined when not present", () => {
    expect(getVerification(createAction())).toBeUndefined();
  });
});

describe("isFullyVerified", () => {
  it("returns true when overall status is verified", () => {
    const action = withVerification(createAction(), baseVerification);
    expect(isFullyVerified(action)).toBe(true);
  });

  it("returns false when status is partial", () => {
    const action = withVerification(createAction(), { ...baseVerification, status: "partial" });
    expect(isFullyVerified(action)).toBe(false);
  });

  it("returns false when status is unverified", () => {
    const action = withVerification(createAction(), { ...baseVerification, status: "unverified" });
    expect(isFullyVerified(action)).toBe(false);
  });

  it("returns false when extension missing", () => {
    expect(isFullyVerified(createAction())).toBe(false);
  });
});

describe("VERIFICATION_NAMESPACE", () => {
  it("follows ext:namespace@version format", () => {
    expect(VERIFICATION_NAMESPACE).toBe("ext:verification@1.0.0");
  });
});
