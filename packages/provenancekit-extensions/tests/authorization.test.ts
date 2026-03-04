import { describe, it, expect } from "vitest";
import type { Action, Resource, Attribution } from "@provenancekit/eaa-types";
import { cidRef } from "@provenancekit/eaa-types";
import {
  AUTHORIZATION_NAMESPACE,
  AuthorizationStatus,
  AuthorizationExtension,
  withAuthorization,
  getAuthorization,
  hasAuthorization,
  isAuthorized,
  isRevoked,
  isPendingAuthorization,
} from "../src/authorization";

// ─── Helpers ────────────────────────────────────────────────────────────────

const createAction = (): Action => ({
  id: "action-1",
  type: "create",
  performedBy: "did:key:alice",
  timestamp: "2025-01-15T10:00:00Z",
  inputs: [],
  outputs: [],
});

const createResource = (): Resource => ({
  address: cidRef("bafytest123"),
  type: "image",
  locations: [],
  createdAt: "2025-01-15T10:00:00Z",
  createdBy: "alice",
  rootAction: "action-1",
});

const createAttribution = (): Attribution => ({
  resourceRef: cidRef("bafytest123"),
  entityId: "alice",
  role: "creator",
});

const FUTURE = "2099-01-01T00:00:00Z";
const PAST = "2000-01-01T00:00:00Z";

// ─── AuthorizationStatus ─────────────────────────────────────────────────────

describe("AuthorizationStatus", () => {
  it("accepts all valid statuses", () => {
    for (const s of ["authorized", "unauthorized", "pending", "revoked"]) {
      expect(AuthorizationStatus.safeParse(s).success).toBe(true);
    }
  });

  it("rejects unknown status", () => {
    expect(AuthorizationStatus.safeParse("approved").success).toBe(false);
    expect(AuthorizationStatus.safeParse("").success).toBe(false);
  });
});

// ─── AuthorizationExtension schema ───────────────────────────────────────────

describe("AuthorizationExtension schema", () => {
  it("validates minimal authorized extension (status only)", () => {
    const result = AuthorizationExtension.safeParse({ status: "authorized" });
    expect(result.success).toBe(true);
  });

  it("validates full authorized extension", () => {
    const result = AuthorizationExtension.safeParse({
      status: "authorized",
      authorizedBy: "did:key:alice",
      authorizedAt: "2025-01-15T10:00:00Z",
      expiresAt: FUTURE,
      reference: "contract:2025-001",
      scope: "Commercial reproduction rights for product demo",
      proof: "0xabc...def",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("authorized");
      expect(result.data.authorizedBy).toBe("did:key:alice");
      expect(result.data.reference).toBe("contract:2025-001");
    }
  });

  it("validates unauthorized status (for enforcement records)", () => {
    const result = AuthorizationExtension.safeParse({
      status: "unauthorized",
      scope: "Use without permission detected",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("unauthorized");
    }
  });

  it("validates pending status", () => {
    const result = AuthorizationExtension.safeParse({
      status: "pending",
      scope: "Requested: AI training use under DSM Art. 4",
    });
    expect(result.success).toBe(true);
  });

  it("validates revoked status with reference", () => {
    const result = AuthorizationExtension.safeParse({
      status: "revoked",
      authorizedBy: "did:key:alice",
      authorizedAt: "2025-01-01T00:00:00Z",
      expiresAt: "2025-06-01T00:00:00Z",
      reference: "revocation:2025-06-01-001",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("revoked");
    }
  });

  it("requires status field", () => {
    const result = AuthorizationExtension.safeParse({
      authorizedBy: "did:key:alice",
      scope: "Something",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = AuthorizationExtension.safeParse({ status: "approved" });
    expect(result.success).toBe(false);
  });

  it("validates authorizedAt as ISO 8601 datetime", () => {
    const valid = AuthorizationExtension.safeParse({
      status: "authorized",
      authorizedAt: "2025-01-15T10:00:00Z",
    });
    expect(valid.success).toBe(true);

    const invalid = AuthorizationExtension.safeParse({
      status: "authorized",
      authorizedAt: "not-a-date",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates expiresAt as ISO 8601 datetime", () => {
    const valid = AuthorizationExtension.safeParse({
      status: "authorized",
      expiresAt: FUTURE,
    });
    expect(valid.success).toBe(true);

    const invalid = AuthorizationExtension.safeParse({
      status: "authorized",
      expiresAt: "31/12/2025",
    });
    expect(invalid.success).toBe(false);
  });

  it("all fields are optional except status", () => {
    const result = AuthorizationExtension.safeParse({ status: "pending" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authorizedBy).toBeUndefined();
      expect(result.data.reference).toBeUndefined();
      expect(result.data.proof).toBeUndefined();
    }
  });
});

// ─── withAuthorization ────────────────────────────────────────────────────────

describe("withAuthorization", () => {
  it("adds authorization to an action", () => {
    const action = createAction();
    const result = withAuthorization(action, { status: "authorized" });
    expect(result.extensions?.[AUTHORIZATION_NAMESPACE]).toBeDefined();
    expect(result.id).toBe("action-1"); // original fields preserved
  });

  it("adds authorization to a resource", () => {
    const resource = createResource();
    const result = withAuthorization(resource, {
      status: "authorized",
      scope: "Public display rights",
    });
    const ext = result.extensions?.[AUTHORIZATION_NAMESPACE] as Record<string, unknown>;
    expect(ext?.status).toBe("authorized");
    expect(ext?.scope).toBe("Public display rights");
  });

  it("adds authorization to an attribution", () => {
    const attr = createAttribution();
    const result = withAuthorization(attr, { status: "pending" });
    expect(result.extensions?.[AUTHORIZATION_NAMESPACE]).toBeDefined();
    expect(result.entityId).toBe("alice");
  });

  it("preserves existing extensions", () => {
    const action: Action = {
      ...createAction(),
      extensions: { "ext:other@1.0.0": { foo: "bar" } },
    };
    const result = withAuthorization(action, { status: "authorized" });
    expect(result.extensions?.[AUTHORIZATION_NAMESPACE]).toBeDefined();
    expect(result.extensions?.["ext:other@1.0.0"]).toEqual({ foo: "bar" });
  });

  it("overwrites existing authorization extension", () => {
    const action = withAuthorization(createAction(), { status: "pending" });
    const updated = withAuthorization(action, { status: "authorized" });
    const ext = updated.extensions?.[AUTHORIZATION_NAMESPACE] as Record<string, unknown>;
    expect(ext?.status).toBe("authorized");
  });

  it("validates input and throws on invalid data", () => {
    expect(() =>
      withAuthorization(createAction(), { status: "invalid-status" as "authorized" })
    ).toThrow();
  });
});

// ─── getAuthorization ─────────────────────────────────────────────────────────

describe("getAuthorization", () => {
  it("returns authorization data when present", () => {
    const action = withAuthorization(createAction(), {
      status: "authorized",
      authorizedBy: "did:key:alice",
      scope: "Test scope",
    });
    const auth = getAuthorization(action);
    expect(auth?.status).toBe("authorized");
    expect(auth?.authorizedBy).toBe("did:key:alice");
    expect(auth?.scope).toBe("Test scope");
  });

  it("returns undefined when extension not present", () => {
    expect(getAuthorization(createAction())).toBeUndefined();
    expect(getAuthorization(createResource())).toBeUndefined();
  });

  it("returns full auth data including all optional fields", () => {
    const action = withAuthorization(createAction(), {
      status: "authorized",
      authorizedBy: "did:key:alice",
      authorizedAt: "2025-01-15T10:00:00Z",
      expiresAt: FUTURE,
      reference: "contract:001",
      proof: "0xabc",
    });
    const auth = getAuthorization(action);
    expect(auth?.expiresAt).toBe(FUTURE);
    expect(auth?.reference).toBe("contract:001");
    expect(auth?.proof).toBe("0xabc");
  });
});

// ─── hasAuthorization ─────────────────────────────────────────────────────────

describe("hasAuthorization", () => {
  it("returns true when authorization extension exists", () => {
    const action = withAuthorization(createAction(), { status: "authorized" });
    expect(hasAuthorization(action)).toBe(true);
  });

  it("returns true even for unauthorized status", () => {
    const action = withAuthorization(createAction(), { status: "unauthorized" });
    expect(hasAuthorization(action)).toBe(true);
  });

  it("returns false when no authorization extension", () => {
    expect(hasAuthorization(createAction())).toBe(false);
    expect(hasAuthorization(createResource())).toBe(false);
  });
});

// ─── isAuthorized ─────────────────────────────────────────────────────────────

describe("isAuthorized", () => {
  it("returns true for authorized status without expiry", () => {
    const action = withAuthorization(createAction(), { status: "authorized" });
    expect(isAuthorized(action)).toBe(true);
  });

  it("returns true for authorized status with future expiry", () => {
    const action = withAuthorization(createAction(), {
      status: "authorized",
      expiresAt: FUTURE,
    });
    expect(isAuthorized(action)).toBe(true);
  });

  it("returns false for authorized status with past expiry", () => {
    const action = withAuthorization(createAction(), {
      status: "authorized",
      expiresAt: PAST,
    });
    expect(isAuthorized(action)).toBe(false);
  });

  it("returns false for unauthorized status", () => {
    const action = withAuthorization(createAction(), { status: "unauthorized" });
    expect(isAuthorized(action)).toBe(false);
  });

  it("returns false for pending status", () => {
    const action = withAuthorization(createAction(), { status: "pending" });
    expect(isAuthorized(action)).toBe(false);
  });

  it("returns false for revoked status", () => {
    const action = withAuthorization(createAction(), { status: "revoked" });
    expect(isAuthorized(action)).toBe(false);
  });

  it("returns false when no authorization extension", () => {
    expect(isAuthorized(createAction())).toBe(false);
  });

  it("respects custom 'now' date for expiry check", () => {
    const action = withAuthorization(createAction(), {
      status: "authorized",
      expiresAt: "2025-06-01T00:00:00Z",
    });
    // Checking from before the expiry
    expect(isAuthorized(action, new Date("2025-01-01T00:00:00Z"))).toBe(true);
    // Checking from after the expiry
    expect(isAuthorized(action, new Date("2025-07-01T00:00:00Z"))).toBe(false);
  });
});

// ─── isRevoked ────────────────────────────────────────────────────────────────

describe("isRevoked", () => {
  it("returns true for revoked status", () => {
    const action = withAuthorization(createAction(), { status: "revoked" });
    expect(isRevoked(action)).toBe(true);
  });

  it("returns false for authorized status", () => {
    const action = withAuthorization(createAction(), { status: "authorized" });
    expect(isRevoked(action)).toBe(false);
  });

  it("returns false for pending status", () => {
    const action = withAuthorization(createAction(), { status: "pending" });
    expect(isRevoked(action)).toBe(false);
  });

  it("returns false when no authorization extension", () => {
    expect(isRevoked(createAction())).toBe(false);
  });
});

// ─── isPendingAuthorization ───────────────────────────────────────────────────

describe("isPendingAuthorization", () => {
  it("returns true for pending status", () => {
    const action = withAuthorization(createAction(), { status: "pending" });
    expect(isPendingAuthorization(action)).toBe(true);
  });

  it("returns false for authorized status", () => {
    const action = withAuthorization(createAction(), { status: "authorized" });
    expect(isPendingAuthorization(action)).toBe(false);
  });

  it("returns false when no authorization extension", () => {
    expect(isPendingAuthorization(createAction())).toBe(false);
  });
});

// ─── AUTHORIZATION_NAMESPACE ──────────────────────────────────────────────────

describe("AUTHORIZATION_NAMESPACE", () => {
  it("follows ext:namespace@version format", () => {
    expect(AUTHORIZATION_NAMESPACE).toBe("ext:authorization@1.0.0");
  });
});

// ─── Real-world usage scenarios ───────────────────────────────────────────────

describe("real-world usage scenarios", () => {
  it("GDPR consent scenario: records consent on an action", () => {
    const action = withAuthorization(createAction(), {
      status: "authorized",
      authorizedBy: "user:patient-123",
      authorizedAt: "2025-01-15T10:00:00Z",
      scope: "Medical data processing consent under GDPR Art. 9",
      reference: "consent-form:2025-01-15-patient-123",
    });
    expect(isAuthorized(action)).toBe(true);
    expect(getAuthorization(action)?.scope).toContain("GDPR");
  });

  it("AI training opt-out enforcement: records unauthorized use", () => {
    const resource = withAuthorization(createResource(), {
      status: "unauthorized",
      scope: "AI training use is reserved under DSM Art. 4(3). Use attempted and blocked.",
      reference: "policy:ai-training-reserved",
    });
    expect(isAuthorized(resource)).toBe(false);
    expect(hasAuthorization(resource)).toBe(true);
    expect(getAuthorization(resource)?.status).toBe("unauthorized");
  });

  it("license grant scenario: records purchase-backed rights grant", () => {
    const attr = withAuthorization(createAttribution(), {
      status: "authorized",
      authorizedBy: "org:rights-holder",
      authorizedAt: "2025-01-15T10:00:00Z",
      expiresAt: "2099-01-15T00:00:00Z",
      reference: "stripe-pi-abc123",
      scope: "One-year commercial license for product use",
    });
    expect(isAuthorized(attr)).toBe(true);
    expect(getAuthorization(attr)?.reference).toBe("stripe-pi-abc123");
  });

  it("delegation scenario: records delegated access", () => {
    const action = withAuthorization(createAction(), {
      status: "authorized",
      authorizedBy: "did:key:principal",
      scope: "Delegated write access to resource namespace",
      proof: "sig:abc123",
    });
    expect(isAuthorized(action)).toBe(true);
    expect(getAuthorization(action)?.proof).toBe("sig:abc123");
  });
});
