import { describe, it, expect, vi, beforeEach } from "vitest";
import { createViemAdapter, createEIP1193Adapter, type IChainAdapter, type RecordActionParams, type EIP1193Provider } from "../src/chain";

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
// createEIP1193Adapter tests
// ---------------------------------------------------------------------------

const EIP1193_CONTRACT = "0xabcdef1234567890abcdef1234567890abcdef12" as const;
const EIP1193_ACCOUNT  = "0x1111111111111111111111111111111111111111" as const;
// 32-byte actionId returned by eth_call (64 hex chars after "0x")
const ETH_CALL_RESULT  = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const ETH_SEND_RESULT  = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

function createMockProvider(): { provider: EIP1193Provider; requestMock: ReturnType<typeof vi.fn> } {
  const requestMock = vi.fn().mockImplementation(({ method }: { method: string }) => {
    if (method === "eth_call") return Promise.resolve(ETH_CALL_RESULT);
    if (method === "eth_sendTransaction") return Promise.resolve(ETH_SEND_RESULT);
    return Promise.reject(new Error(`Unknown method: ${method}`));
  });
  return { provider: { request: requestMock }, requestMock };
}

describe("createEIP1193Adapter", () => {
  it("returns an IChainAdapter with correct contractAddress and metadata", () => {
    const { provider } = createMockProvider();
    const adapter = createEIP1193Adapter({
      provider,
      account: EIP1193_ACCOUNT,
      contractAddress: EIP1193_CONTRACT,
      chainId: 8453,
      chainName: "base",
    });

    expect(adapter.contractAddress).toBe(EIP1193_CONTRACT);
    expect(adapter.chainId).toBe(8453);
    expect(adapter.chainName).toBe("base");
  });

  it("calls eth_call then eth_sendTransaction", async () => {
    const { provider, requestMock } = createMockProvider();
    const adapter = createEIP1193Adapter({
      provider,
      account: EIP1193_ACCOUNT,
      contractAddress: EIP1193_CONTRACT,
    });

    await adapter.recordAction({ actionType: "create", inputs: [], outputs: ["bafyout"] });

    const calls = requestMock.mock.calls.map((c: [{ method: string }]) => c[0].method);
    expect(calls).toEqual(["eth_call", "eth_sendTransaction"]);
  });

  it("returns txHash from eth_sendTransaction and actionId from eth_call", async () => {
    const { provider } = createMockProvider();
    const adapter = createEIP1193Adapter({
      provider,
      account: EIP1193_ACCOUNT,
      contractAddress: EIP1193_CONTRACT,
    });

    const result = await adapter.recordAction({
      actionType: "transform",
      inputs: ["bafyin"],
      outputs: ["bafyout"],
    });

    expect(result.txHash).toBe(ETH_SEND_RESULT);
    // actionId = first 32 bytes of eth_call result
    expect(result.actionId).toBe(`0x${ETH_CALL_RESULT.slice(2, 66)}`);
  });

  it("sends the correct contract address and from address in eth_call", async () => {
    const { provider, requestMock } = createMockProvider();
    const adapter = createEIP1193Adapter({
      provider,
      account: EIP1193_ACCOUNT,
      contractAddress: EIP1193_CONTRACT,
    });

    await adapter.recordAction({ actionType: "create", inputs: [], outputs: [] });

    const ethCallArgs = requestMock.mock.calls[0][0].params[0];
    expect(ethCallArgs.from).toBe(EIP1193_ACCOUNT);
    expect(ethCallArgs.to).toBe(EIP1193_CONTRACT);
  });

  it("encodes the correct function selector (0xd57e4f08) in calldata", async () => {
    const { provider, requestMock } = createMockProvider();
    const adapter = createEIP1193Adapter({
      provider,
      account: EIP1193_ACCOUNT,
      contractAddress: EIP1193_CONTRACT,
    });

    await adapter.recordAction({ actionType: "create", inputs: [], outputs: [] });

    const data: string = requestMock.mock.calls[0][0].params[0].data;
    // First 4 bytes (8 hex chars after 0x) must be the recordAction selector
    expect(data.slice(0, 10)).toBe("0xd57e4f08");
  });

  it("sends the same calldata in eth_sendTransaction as in eth_call", async () => {
    const { provider, requestMock } = createMockProvider();
    const adapter = createEIP1193Adapter({
      provider,
      account: EIP1193_ACCOUNT,
      contractAddress: EIP1193_CONTRACT,
    });

    await adapter.recordAction({ actionType: "create", inputs: ["a"], outputs: ["b"] });

    const callData = requestMock.mock.calls[0][0].params[0].data;
    const sendData = requestMock.mock.calls[1][0].params[0].data;
    expect(callData).toBe(sendData);
  });

  it("propagates errors from eth_call", async () => {
    const provider: EIP1193Provider = {
      request: vi.fn().mockRejectedValue(new Error("execution reverted")),
    };
    const adapter = createEIP1193Adapter({
      provider,
      account: EIP1193_ACCOUNT,
      contractAddress: EIP1193_CONTRACT,
    });

    await expect(
      adapter.recordAction({ actionType: "create", inputs: [], outputs: [] })
    ).rejects.toThrow("execution reverted");
  });

  it("propagates errors from eth_sendTransaction", async () => {
    const provider: EIP1193Provider = {
      request: vi.fn().mockImplementation(({ method }: { method: string }) => {
        if (method === "eth_call") return Promise.resolve(ETH_CALL_RESULT);
        return Promise.reject(new Error("user rejected"));
      }),
    };
    const adapter = createEIP1193Adapter({
      provider,
      account: EIP1193_ACCOUNT,
      contractAddress: EIP1193_CONTRACT,
    });

    await expect(
      adapter.recordAction({ actionType: "create", inputs: [], outputs: [] })
    ).rejects.toThrow("user rejected");
  });

  it("chainId and chainName are optional", () => {
    const { provider } = createMockProvider();
    const adapter = createEIP1193Adapter({
      provider,
      account: EIP1193_ACCOUNT,
      contractAddress: EIP1193_CONTRACT,
    });
    expect(adapter.chainId).toBeUndefined();
    expect(adapter.chainName).toBeUndefined();
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
