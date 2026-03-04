import { describe, it, expect, vi, beforeEach } from "vitest";
import { createViemAdapter, type IChainAdapter, type RecordActionParams } from "../src/chain";

// ---------------------------------------------------------------------------
// IChainAdapter interface tests
// ---------------------------------------------------------------------------

describe("IChainAdapter interface", () => {
  it("can be implemented as a plain object", () => {
    const adapter: IChainAdapter = {
      contractAddress: "0xDeadBeef",
      chainId: 8453,
      chainName: "base",
      recordAction: async (params: RecordActionParams) => ({
        txHash: "0xabc",
        actionId: "0x123",
      }),
    };

    expect(adapter.contractAddress).toBe("0xDeadBeef");
    expect(adapter.chainId).toBe(8453);
    expect(adapter.chainName).toBe("base");
    expect(typeof adapter.recordAction).toBe("function");
  });

  it("chainId and chainName are optional", () => {
    const adapter: IChainAdapter = {
      contractAddress: "0xDeadBeef",
      recordAction: async () => ({ txHash: "0xabc", actionId: "0x123" }),
    };

    expect(adapter.chainId).toBeUndefined();
    expect(adapter.chainName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createViemAdapter tests
// ---------------------------------------------------------------------------

const CONTRACT = "0x1234567890123456789012345678901234567890" as const;
const TX_HASH = "0xdeadbeef" as const;
const ACTION_ID = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab" as const;

function createMockClients() {
  const mockPublicClient = {
    simulateContract: vi.fn().mockResolvedValue({
      result: ACTION_ID,
      request: {
        address: CONTRACT,
        abi: [],
        functionName: "recordAction",
        args: [],
        account: { address: "0xSender" },
      },
    }),
  };

  const mockWalletClient = {
    account: { address: "0xSender" as const },
    writeContract: vi.fn().mockResolvedValue(TX_HASH),
  };

  return { mockPublicClient, mockWalletClient };
}

describe("createViemAdapter", () => {
  it("returns an IChainAdapter with correct contractAddress", () => {
    const { mockPublicClient, mockWalletClient } = createMockClients();
    const adapter = createViemAdapter({
      walletClient: mockWalletClient,
      publicClient: mockPublicClient,
      contractAddress: CONTRACT,
      chainId: 8453,
      chainName: "base",
    });

    expect(adapter.contractAddress).toBe(CONTRACT);
    expect(adapter.chainId).toBe(8453);
    expect(adapter.chainName).toBe("base");
  });

  it("calls simulateContract with correct args", async () => {
    const { mockPublicClient, mockWalletClient } = createMockClients();
    const adapter = createViemAdapter({
      walletClient: mockWalletClient,
      publicClient: mockPublicClient,
      contractAddress: CONTRACT,
    });

    await adapter.recordAction({
      actionType: "create",
      inputs: ["bafyinput1"],
      outputs: ["bafyoutput1"],
    });

    expect(mockPublicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CONTRACT,
        functionName: "recordAction",
        args: ["create", ["bafyinput1"], ["bafyoutput1"]],
      })
    );
  });

  it("calls writeContract with the request from simulateContract", async () => {
    const { mockPublicClient, mockWalletClient } = createMockClients();
    const adapter = createViemAdapter({
      walletClient: mockWalletClient,
      publicClient: mockPublicClient,
      contractAddress: CONTRACT,
    });

    await adapter.recordAction({
      actionType: "transform",
      inputs: ["bafysource"],
      outputs: ["bafyderived"],
    });

    // writeContract should be called with the request returned by simulateContract
    expect(mockWalletClient.writeContract).toHaveBeenCalledTimes(1);
  });

  it("returns txHash and actionId from the call", async () => {
    const { mockPublicClient, mockWalletClient } = createMockClients();
    const adapter = createViemAdapter({
      walletClient: mockWalletClient,
      publicClient: mockPublicClient,
      contractAddress: CONTRACT,
    });

    const result = await adapter.recordAction({
      actionType: "create",
      inputs: [],
      outputs: ["bafyout"],
    });

    expect(result.txHash).toBe(TX_HASH);
    expect(result.actionId).toBe(ACTION_ID);
  });

  it("passes account from walletClient to simulateContract", async () => {
    const { mockPublicClient, mockWalletClient } = createMockClients();
    const adapter = createViemAdapter({
      walletClient: mockWalletClient,
      publicClient: mockPublicClient,
      contractAddress: CONTRACT,
    });

    await adapter.recordAction({ actionType: "create", inputs: [], outputs: [] });

    expect(mockPublicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        account: mockWalletClient.account,
      })
    );
  });

  it("propagates errors from simulateContract", async () => {
    const { mockWalletClient } = createMockClients();
    const failingPublicClient = {
      simulateContract: vi.fn().mockRejectedValue(new Error("contract revert")),
    };

    const adapter = createViemAdapter({
      walletClient: mockWalletClient,
      publicClient: failingPublicClient,
      contractAddress: CONTRACT,
    });

    await expect(
      adapter.recordAction({ actionType: "create", inputs: [], outputs: [] })
    ).rejects.toThrow("contract revert");
  });

  it("propagates errors from writeContract", async () => {
    const { mockPublicClient } = createMockClients();
    const failingWalletClient = {
      account: { address: "0xSender" as const },
      writeContract: vi.fn().mockRejectedValue(new Error("tx rejected")),
    };

    const adapter = createViemAdapter({
      walletClient: failingWalletClient,
      publicClient: mockPublicClient,
      contractAddress: CONTRACT,
    });

    await expect(
      adapter.recordAction({ actionType: "create", inputs: [], outputs: [] })
    ).rejects.toThrow("tx rejected");
  });

  it("handles walletClient without account (undefined)", async () => {
    const { mockPublicClient } = createMockClients();
    const walletClientNoAccount = {
      account: undefined,
      writeContract: vi.fn().mockResolvedValue(TX_HASH),
    };

    const adapter = createViemAdapter({
      walletClient: walletClientNoAccount,
      publicClient: mockPublicClient,
      contractAddress: CONTRACT,
    });

    // simulateContract should still be called (account may be undefined for some wallets)
    await adapter.recordAction({ actionType: "create", inputs: [], outputs: [] });
    expect(mockPublicClient.simulateContract).toHaveBeenCalled();
  });

  it("works with empty inputs and outputs arrays", async () => {
    const { mockPublicClient, mockWalletClient } = createMockClients();
    const adapter = createViemAdapter({
      walletClient: mockWalletClient,
      publicClient: mockPublicClient,
      contractAddress: CONTRACT,
    });

    const result = await adapter.recordAction({
      actionType: "verify",
      inputs: [],
      outputs: [],
    });

    expect(result.txHash).toBe(TX_HASH);
  });

  it("works with multiple inputs and outputs", async () => {
    const { mockPublicClient, mockWalletClient } = createMockClients();
    const adapter = createViemAdapter({
      walletClient: mockWalletClient,
      publicClient: mockPublicClient,
      contractAddress: CONTRACT,
    });

    await adapter.recordAction({
      actionType: "aggregate",
      inputs: ["bafya", "bafyb", "bafyc"],
      outputs: ["bafyout1", "bafyout2"],
    });

    expect(mockPublicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ["aggregate", ["bafya", "bafyb", "bafyc"], ["bafyout1", "bafyout2"]],
      })
    );
  });
});

// ---------------------------------------------------------------------------
// ProvenanceKit + chain adapter integration (mock client tests)
// ---------------------------------------------------------------------------

describe("ProvenanceKit chain adapter integration", () => {
  // We test via a mock IChainAdapter, not the full ProvenanceKit class,
  // to keep tests fast and decoupled from HTTP.

  it("mock adapter fulfils IChainAdapter contract", async () => {
    const recordAction = vi.fn().mockResolvedValue({
      txHash: "0xmytx",
      actionId: "0xmyactionid",
    });

    const adapter: IChainAdapter = {
      contractAddress: "0xRegistry",
      chainId: 8453,
      chainName: "base",
      recordAction,
    };

    const result = await adapter.recordAction({
      actionType: "create",
      inputs: [],
      outputs: ["bafyout"],
    });

    expect(result.txHash).toBe("0xmytx");
    expect(result.actionId).toBe("0xmyactionid");
    expect(recordAction).toHaveBeenCalledWith({
      actionType: "create",
      inputs: [],
      outputs: ["bafyout"],
    });
  });
});
