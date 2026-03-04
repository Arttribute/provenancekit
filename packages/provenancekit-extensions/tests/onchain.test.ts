import { describe, it, expect } from "vitest";
import type { Action, Resource, Attribution } from "@provenancekit/eaa-types";
import { cidRef } from "@provenancekit/eaa-types";
import {
  ONCHAIN_NAMESPACE,
  OnchainExtension,
  withOnchain,
  getOnchain,
  hasOnchain,
  isOnChain,
  getTxHash,
} from "../src/onchain";

const createAction = (): Action => ({
  type: "create",
  performedBy: "did:key:alice",
  timestamp: new Date().toISOString(),
  inputs: [],
  outputs: [],
});

const createResource = (): Resource => ({
  address: cidRef("bafytest123"),
  type: "image",
});

const createAttribution = (): Attribution => ({
  resourceRef: cidRef("bafytest123"),
  entityId: "alice",
  role: "creator",
});

describe("onchain extension", () => {
  describe("ONCHAIN_NAMESPACE", () => {
    it("has correct value", () => {
      expect(ONCHAIN_NAMESPACE).toBe("ext:onchain@1.0.0");
    });
  });

  describe("OnchainExtension schema", () => {
    it("validates minimal on-chain config", () => {
      const result = OnchainExtension.safeParse({
        chainId: 8453,
        blockNumber: 12345678,
        transactionHash: "0xabc123",
      });
      expect(result.success).toBe(true);
    });

    it("validates full on-chain config", () => {
      const result = OnchainExtension.safeParse({
        chainId: 8453,
        chainName: "Base",
        blockNumber: 12345678,
        blockTimestamp: "2024-01-15T10:30:00Z",
        transactionHash: "0xabc123def456",
        logIndex: 3,
        contractAddress: "0x1234567890abcdef",
        confirmed: true,
        confirmations: 12,
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing required fields", () => {
      const missingChainId = OnchainExtension.safeParse({
        blockNumber: 12345678,
        transactionHash: "0xabc123",
      });
      expect(missingChainId.success).toBe(false);

      const missingBlockNumber = OnchainExtension.safeParse({
        chainId: 8453,
        transactionHash: "0xabc123",
      });
      expect(missingBlockNumber.success).toBe(false);

      const missingTxHash = OnchainExtension.safeParse({
        chainId: 8453,
        blockNumber: 12345678,
      });
      expect(missingTxHash.success).toBe(false);
    });

    it("validates datetime format for blockTimestamp", () => {
      const valid = OnchainExtension.safeParse({
        chainId: 8453,
        blockNumber: 12345678,
        transactionHash: "0xabc123",
        blockTimestamp: "2024-01-15T10:30:00Z",
      });
      expect(valid.success).toBe(true);

      const invalid = OnchainExtension.safeParse({
        chainId: 8453,
        blockNumber: 12345678,
        transactionHash: "0xabc123",
        blockTimestamp: "not-a-date",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("withOnchain", () => {
    it("adds on-chain extension to action", () => {
      const action = createAction();
      const result = withOnchain(action, {
        chainId: 8453,
        blockNumber: 12345678,
        transactionHash: "0xabc123",
      });

      expect(result.extensions?.[ONCHAIN_NAMESPACE]).toBeDefined();
      const onchain = result.extensions?.[ONCHAIN_NAMESPACE] as any;
      expect(onchain.chainId).toBe(8453);
      expect(onchain.transactionHash).toBe("0xabc123");
    });

    it("adds on-chain extension to resource", () => {
      const resource = createResource();
      const result = withOnchain(resource, {
        chainId: 1,
        chainName: "Ethereum",
        blockNumber: 18000000,
        transactionHash: "0xdef456",
      });

      expect(result.extensions?.[ONCHAIN_NAMESPACE]).toBeDefined();
    });

    it("adds on-chain extension to attribution", () => {
      const attr = createAttribution();
      const result = withOnchain(attr, {
        chainId: 8453,
        blockNumber: 12345678,
        transactionHash: "0xghi789",
      });

      expect(result.extensions?.[ONCHAIN_NAMESPACE]).toBeDefined();
    });

    it("preserves existing properties", () => {
      const action = createAction();
      const result = withOnchain(action, {
        chainId: 8453,
        blockNumber: 12345678,
        transactionHash: "0xabc123",
      });

      expect(result.type).toBe("create");
      expect(result.performedBy).toBe("did:key:alice");
    });

    it("preserves existing extensions", () => {
      const action: Action = {
        ...createAction(),
        extensions: { "ext:other": { value: 42 } },
      };
      const result = withOnchain(action, {
        chainId: 8453,
        blockNumber: 12345678,
        transactionHash: "0xabc123",
      });

      expect(result.extensions?.["ext:other"]).toEqual({ value: 42 });
    });

    it("validates input", () => {
      const action = createAction();
      expect(() =>
        withOnchain(action, { chainId: 8453 } as any)
      ).toThrow();
    });
  });

  describe("getOnchain", () => {
    it("returns on-chain extension when present", () => {
      const action = withOnchain(createAction(), {
        chainId: 8453,
        chainName: "Base",
        blockNumber: 12345678,
        transactionHash: "0xabc123",
        confirmed: true,
      });

      const onchain = getOnchain(action);

      expect(onchain).toBeDefined();
      expect(onchain?.chainId).toBe(8453);
      expect(onchain?.chainName).toBe("Base");
      expect(onchain?.blockNumber).toBe(12345678);
      expect(onchain?.transactionHash).toBe("0xabc123");
      expect(onchain?.confirmed).toBe(true);
    });

    it("returns undefined when not present", () => {
      expect(getOnchain(createAction())).toBeUndefined();
    });
  });

  describe("hasOnchain", () => {
    it("returns true when on-chain extension exists", () => {
      const action = withOnchain(createAction(), {
        chainId: 8453,
        blockNumber: 12345678,
        transactionHash: "0xabc123",
      });

      expect(hasOnchain(action)).toBe(true);
    });

    it("returns false when on-chain extension does not exist", () => {
      expect(hasOnchain(createAction())).toBe(false);
    });
  });

  describe("isOnChain", () => {
    it("returns true when anchored on specified chain", () => {
      const action = withOnchain(createAction(), {
        chainId: 8453,
        blockNumber: 12345678,
        transactionHash: "0xabc123",
      });

      expect(isOnChain(action, 8453)).toBe(true);
    });

    it("returns false when anchored on different chain", () => {
      const action = withOnchain(createAction(), {
        chainId: 8453,
        blockNumber: 12345678,
        transactionHash: "0xabc123",
      });

      expect(isOnChain(action, 1)).toBe(false);
    });

    it("returns false when not anchored", () => {
      expect(isOnChain(createAction(), 8453)).toBe(false);
    });
  });

  describe("getTxHash", () => {
    it("returns transaction hash when present", () => {
      const action = withOnchain(createAction(), {
        chainId: 8453,
        blockNumber: 12345678,
        transactionHash: "0xabc123def456",
      });

      expect(getTxHash(action)).toBe("0xabc123def456");
    });

    it("returns undefined when not anchored", () => {
      expect(getTxHash(createAction())).toBeUndefined();
    });
  });

  describe("common chain IDs", () => {
    it("works with Ethereum mainnet", () => {
      const action = withOnchain(createAction(), {
        chainId: 1,
        chainName: "Ethereum",
        blockNumber: 18000000,
        transactionHash: "0xeth123",
      });

      expect(isOnChain(action, 1)).toBe(true);
      expect(getOnchain(action)?.chainName).toBe("Ethereum");
    });

    it("works with Base", () => {
      const action = withOnchain(createAction(), {
        chainId: 8453,
        chainName: "Base",
        blockNumber: 5000000,
        transactionHash: "0xbase123",
      });

      expect(isOnChain(action, 8453)).toBe(true);
    });

    it("works with Optimism", () => {
      const action = withOnchain(createAction(), {
        chainId: 10,
        chainName: "Optimism",
        blockNumber: 100000000,
        transactionHash: "0xop123",
      });

      expect(isOnChain(action, 10)).toBe(true);
    });

    it("works with Arbitrum", () => {
      const action = withOnchain(createAction(), {
        chainId: 42161,
        chainName: "Arbitrum One",
        blockNumber: 150000000,
        transactionHash: "0xarb123",
      });

      expect(isOnChain(action, 42161)).toBe(true);
    });
  });
});
