import { describe, it, expect } from "vitest";
import type { Action } from "@provenancekit/eaa-types";
import {
  WITNESS_NAMESPACE,
  EnvironmentAttestation,
  WitnessExtension,
  withWitness,
  getWitness,
  hasWitness,
} from "../src/witness";

const createAction = (): Action => ({
  id: "action-1",
  type: "create",
  performedBy: "did:key:alice",
  timestamp: "2025-01-15T10:00:00Z",
  inputs: [],
  outputs: [],
});

const baseWitness = {
  actionId: "action-1",
  entityId: "did:key:alice",
  outputCid: "bafybeiabc123",
  actionProofHash: "sha256:deadbeef",
  serverSignature: "ed25519sig",
  serverPublicKey: "pubkey123",
  timestamp: "2025-01-15T10:00:00Z",
};

describe("EnvironmentAttestation schema", () => {
  it("validates minimal attestation (type + report)", () => {
    const result = EnvironmentAttestation.safeParse({
      type: "aws-nitro",
      report: "base64encodedreport==",
    });
    expect(result.success).toBe(true);
  });

  it("accepts any string type (open enum)", () => {
    for (const t of ["intel-sgx", "aws-nitro", "marlin-oyster", "amd-sev-snp", "tpm", "custom-hsm"]) {
      const result = EnvironmentAttestation.safeParse({ type: t, report: "abc" });
      expect(result.success).toBe(true);
    }
  });

  it("validates full attestation with measurements and nonce", () => {
    const result = EnvironmentAttestation.safeParse({
      type: "intel-sgx",
      report: "base64report==",
      measurements: { mrenclave: "aabbcc", mrsigner: "ddeeff" },
      nonce: "sha256:deadbeef",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurements?.mrenclave).toBe("aabbcc");
      expect(result.data.nonce).toBe("sha256:deadbeef");
    }
  });

  it("requires type field", () => {
    const result = EnvironmentAttestation.safeParse({ report: "abc" });
    expect(result.success).toBe(false);
  });

  it("requires report field", () => {
    const result = EnvironmentAttestation.safeParse({ type: "aws-nitro" });
    expect(result.success).toBe(false);
  });
});

describe("WitnessExtension schema", () => {
  it("validates witness without attestation", () => {
    const result = WitnessExtension.safeParse(baseWitness);
    expect(result.success).toBe(true);
  });

  it("validates witness with attestation", () => {
    const result = WitnessExtension.safeParse({
      ...baseWitness,
      attestation: {
        type: "aws-nitro",
        report: "base64report==",
        measurements: { pcr0: "aabbcc", pcr1: "ddeeff", pcr2: "112233" },
        nonce: "sha256:deadbeef",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attestation?.type).toBe("aws-nitro");
      expect(result.data.attestation?.measurements?.pcr0).toBe("aabbcc");
    }
  });

  it("requires timestamp in ISO 8601 format", () => {
    const result = WitnessExtension.safeParse({ ...baseWitness, timestamp: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("requires all core fields", () => {
    for (const field of ["actionId", "entityId", "outputCid", "actionProofHash", "serverSignature", "serverPublicKey", "timestamp"] as const) {
      const partial = { ...baseWitness };
      delete (partial as Record<string, unknown>)[field];
      expect(WitnessExtension.safeParse(partial).success).toBe(false);
    }
  });
});

describe("withWitness", () => {
  it("adds witness extension to action", () => {
    const action = createAction();
    const result = withWitness(action, baseWitness);
    expect(result.extensions?.[WITNESS_NAMESPACE]).toBeDefined();
    expect(result.id).toBe("action-1");
  });

  it("adds witness with environment attestation", () => {
    const action = createAction();
    const result = withWitness(action, {
      ...baseWitness,
      attestation: { type: "aws-nitro", report: "base64report==" },
    });
    const witness = result.extensions?.[WITNESS_NAMESPACE] as Record<string, unknown>;
    expect((witness?.attestation as Record<string, unknown>)?.type).toBe("aws-nitro");
  });

  it("preserves existing extensions", () => {
    const action: Action = {
      ...createAction(),
      extensions: { "ext:other@1.0.0": { foo: "bar" } },
    };
    const result = withWitness(action, baseWitness);
    expect(result.extensions?.[WITNESS_NAMESPACE]).toBeDefined();
    expect(result.extensions?.["ext:other@1.0.0"]).toEqual({ foo: "bar" });
  });
});

describe("getWitness", () => {
  it("returns witness data when present", () => {
    const action = withWitness(createAction(), baseWitness);
    const witness = getWitness(action);
    expect(witness?.actionId).toBe("action-1");
    expect(witness?.entityId).toBe("did:key:alice");
    expect(witness?.outputCid).toBe("bafybeiabc123");
  });

  it("returns witness with attestation intact", () => {
    const action = withWitness(createAction(), {
      ...baseWitness,
      attestation: {
        type: "intel-sgx",
        report: "base64report==",
        measurements: { mrenclave: "aabbcc" },
        nonce: "sha256:deadbeef",
      },
    });
    const witness = getWitness(action);
    expect(witness?.attestation?.type).toBe("intel-sgx");
    expect(witness?.attestation?.measurements?.mrenclave).toBe("aabbcc");
    expect(witness?.attestation?.nonce).toBe("sha256:deadbeef");
  });

  it("returns undefined when not present", () => {
    expect(getWitness(createAction())).toBeUndefined();
  });
});

describe("hasWitness", () => {
  it("returns true when extension exists", () => {
    const action = withWitness(createAction(), baseWitness);
    expect(hasWitness(action)).toBe(true);
  });

  it("returns false when extension missing", () => {
    expect(hasWitness(createAction())).toBe(false);
  });
});

describe("WITNESS_NAMESPACE", () => {
  it("follows ext:namespace@version format", () => {
    expect(WITNESS_NAMESPACE).toBe("ext:witness@1.0.0");
  });
});
