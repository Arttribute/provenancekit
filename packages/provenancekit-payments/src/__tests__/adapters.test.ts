/**
 * Payment Adapter Tests
 *
 * Tests for DirectTransferAdapter, SplitsAdapter, and SuperfluidAdapter.
 * Uses mocked viem clients to test adapter logic without chain interaction.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Address, PublicClient, WalletClient } from "viem";
import { zeroAddress, getAddress } from "viem";
import type { Distribution } from "@provenancekit/extensions";

import { DirectTransferAdapter } from "../adapters/direct.js";
import { SplitsAdapter } from "../adapters/splits.js";
import { SuperfluidAdapter } from "../adapters/superfluid.js";
import { PaymentError, NATIVE_TOKEN, CHAIN_IDS } from "../types.js";

/*─────────────────────────────────────────────────────────────*\
 | Test Helpers                                                 |
\*─────────────────────────────────────────────────────────────*/

// Use getAddress to generate proper EIP-55 checksummed addresses
const ALICE = getAddress("0x000000000000000000000000000000000000aaaa");
const BOB = getAddress("0x000000000000000000000000000000000000bbbb");
const SENDER = getAddress("0x000000000000000000000000000000000000cccc");
const TOKEN = getAddress("0x000000000000000000000000000000000000dddd");

function makeCidRef(cid = "bafytest"): { ref: string; scheme: "cid" } {
  return { ref: cid, scheme: "cid" };
}

function makeDistribution(
  entries: Array<{ entityId: string; bps: number; paymentAddress?: string }>
): Distribution {
  return {
    resourceRef: makeCidRef(),
    entries: entries.map((e) => ({
      entityId: e.entityId,
      bps: e.bps,
      ...(e.paymentAddress
        ? { payment: { recipient: { address: e.paymentAddress } } }
        : {}),
    })),
    totalBps: entries.reduce((sum, e) => sum + e.bps, 0),
    metadata: {
      resourceRef: "bafytest",
      contributorCount: entries.length,
      calculatedAt: new Date().toISOString(),
    },
  } as Distribution;
}

let txCounter = 0;

function mockWalletClient(): WalletClient {
  return {
    getAddresses: vi.fn().mockResolvedValue([SENDER]),
    sendTransaction: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(`0xtx${++txCounter}` as `0x${string}`)
      ),
  } as unknown as WalletClient;
}

function mockPublicClient(
  overrides: Partial<{
    getBalance: (...args: unknown[]) => Promise<bigint>;
    readContract: (...args: unknown[]) => Promise<unknown>;
    getGasPrice: () => Promise<bigint>;
    waitForTransactionReceipt: (...args: unknown[]) => Promise<unknown>;
  }> = {}
): PublicClient {
  return {
    getBalance: vi.fn().mockResolvedValue(10n ** 18n), // 1 ETH
    readContract: vi.fn().mockResolvedValue(10n ** 18n), // default for balanceOf
    getGasPrice: vi.fn().mockResolvedValue(1_000_000_000n), // 1 gwei
    waitForTransactionReceipt: vi
      .fn()
      .mockResolvedValue({ status: "success" }),
    ...overrides,
  } as unknown as PublicClient;
}

/*─────────────────────────────────────────────────────────────*\
 | DirectTransferAdapter                                        |
\*─────────────────────────────────────────────────────────────*/

describe("DirectTransferAdapter", () => {
  let adapter: DirectTransferAdapter;
  let wallet: WalletClient;
  let client: PublicClient;

  beforeEach(() => {
    txCounter = 0;
    adapter = new DirectTransferAdapter();
    wallet = mockWalletClient();
    client = mockPublicClient();
  });

  it("has correct metadata", () => {
    expect(adapter.name).toBe("direct");
    expect(adapter.model).toBe("one-time");
    expect(adapter.supportedChains).toContain(CHAIN_IDS.BASE);
    expect(adapter.supportedChains).toContain(CHAIN_IDS.ETHEREUM);
  });

  it("distributes native ETH to multiple recipients", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 6000 },
      { entityId: BOB, bps: 4000 },
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 10000n,
      token: zeroAddress,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
    });

    expect(result.success).toBe(true);
    expect(result.adapter).toBe("direct");
    expect(result.model).toBe("one-time");
    expect(result.payments).toHaveLength(2);
    expect(result.txHashes).toHaveLength(2);

    // 60% of 10000 = 6000, 40% = 4000
    const alicePayment = result.payments.find((p) => p.recipient === ALICE);
    const bobPayment = result.payments.find((p) => p.recipient === BOB);
    expect(alicePayment?.amount).toBe(6000n);
    expect(bobPayment?.amount).toBe(4000n);
    expect(result.totalDistributed).toBe(10000n);
  });

  it("distributes ERC-20 tokens", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 1000n,
      token: TOKEN,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
    });

    expect(result.success).toBe(true);
    expect(result.payments).toHaveLength(2);
    // ERC-20 transfers use sendTransaction with encoded data
    expect(wallet.sendTransaction).toHaveBeenCalled();
  });

  it("resolves recipient from payment extension", async () => {
    const CUSTOM_ADDR = getAddress("0x000000000000000000000000000000000000eeee");
    const dist = makeDistribution([
      {
        entityId: "entity-not-address",
        bps: 10000,
        paymentAddress: CUSTOM_ADDR,
      },
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 100n,
      token: zeroAddress,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
    });

    expect(result.success).toBe(true);
    expect(result.payments[0].recipient).toBe(CUSTOM_ADDR);
  });

  it("throws on empty distribution", async () => {
    const dist = makeDistribution([]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: zeroAddress,
        chainId: CHAIN_IDS.BASE,
        walletClient: wallet,
        publicClient: client,
      })
    ).rejects.toThrow(PaymentError);

    try {
      await adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: zeroAddress,
        chainId: CHAIN_IDS.BASE,
        walletClient: wallet,
        publicClient: client,
      });
    } catch (e) {
      expect((e as PaymentError).code).toBe("EMPTY_DISTRIBUTION");
    }
  });

  it("throws on zero amount", async () => {
    const dist = makeDistribution([{ entityId: ALICE, bps: 10000 }]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 0n,
        token: zeroAddress,
        chainId: CHAIN_IDS.BASE,
        walletClient: wallet,
        publicClient: client,
      })
    ).rejects.toThrow(PaymentError);
  });

  it("throws on insufficient ETH balance", async () => {
    const lowBalanceClient = mockPublicClient({
      getBalance: vi.fn().mockResolvedValue(5n),
    });

    const dist = makeDistribution([{ entityId: ALICE, bps: 10000 }]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: zeroAddress,
        chainId: CHAIN_IDS.BASE,
        walletClient: wallet,
        publicClient: lowBalanceClient,
      })
    ).rejects.toThrow("Insufficient ETH balance");
  });

  it("throws on insufficient ERC-20 balance", async () => {
    const lowTokenClient = mockPublicClient({
      readContract: vi.fn().mockResolvedValue(5n),
    });

    const dist = makeDistribution([{ entityId: ALICE, bps: 10000 }]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: TOKEN,
        chainId: CHAIN_IDS.BASE,
        walletClient: wallet,
        publicClient: lowTokenClient,
      })
    ).rejects.toThrow("Insufficient token balance");
  });

  it("throws when entity has no resolvable address", async () => {
    const dist = makeDistribution([
      { entityId: "uuid-not-an-address", bps: 10000 },
    ]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: zeroAddress,
        chainId: CHAIN_IDS.BASE,
        walletClient: wallet,
        publicClient: client,
      })
    ).rejects.toThrow("Cannot resolve recipient address");
  });

  it("continues after individual transfer failure", async () => {
    let callCount = 0;
    const flakeyWallet = {
      getAddresses: vi.fn().mockResolvedValue([SENDER]),
      sendTransaction: vi.fn().mockImplementation(() => {
        if (++callCount === 1) return Promise.reject(new Error("tx reverted"));
        return Promise.resolve(`0xtx${callCount}` as `0x${string}`);
      }),
    } as unknown as WalletClient;

    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 1000n,
      token: zeroAddress,
      chainId: CHAIN_IDS.BASE,
      walletClient: flakeyWallet,
      publicClient: client,
    });

    expect(result.success).toBe(false);
    expect(result.payments[0].success).toBe(false);
    expect(result.payments[0].error).toBe("tx reverted");
    expect(result.payments[1].success).toBe(true);
  });

  it("estimates fees for native ETH transfers", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    const estimate = await adapter.estimateFees({
      distribution: dist,
      amount: 1000n,
      token: zeroAddress,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
    });

    expect(estimate.txCount).toBe(2);
    // 2 native transfers * 21000 gas * 1 gwei
    expect(estimate.gasEstimate).toBe(21_000n * 2n * 1_000_000_000n);
  });

  it("estimates higher fees for ERC-20 transfers", async () => {
    const dist = makeDistribution([{ entityId: ALICE, bps: 10000 }]);

    const estimate = await adapter.estimateFees({
      distribution: dist,
      amount: 1000n,
      token: TOKEN,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
    });

    // 1 ERC-20 transfer * 65000 gas * 1 gwei
    expect(estimate.gasEstimate).toBe(65_000n * 1_000_000_000n);
  });

  it("supportsToken always returns true", async () => {
    expect(await adapter.supportsToken(TOKEN, CHAIN_IDS.BASE)).toBe(true);
  });

  it("handles dust correctly", async () => {
    // 3 recipients each with 3333 bps + 1 bps remainder
    const dist = makeDistribution([
      { entityId: ALICE, bps: 3334 },
      { entityId: BOB, bps: 3333 },
      {
        entityId: getAddress("0x000000000000000000000000000000000000ffff"),
        bps: 3333,
      },
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 10000n,
      token: zeroAddress,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
    });

    expect(result.success).toBe(true);
    // The dust should be small (< number of recipients)
    expect(result.dust).toBeLessThan(3n);
    // Total distributed + dust should equal original amount
    expect(result.totalDistributed + result.dust).toBe(10000n);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | SplitsAdapter                                                |
\*─────────────────────────────────────────────────────────────*/

describe("SplitsAdapter", () => {
  let adapter: SplitsAdapter;
  let wallet: WalletClient;
  let client: PublicClient;

  beforeEach(() => {
    txCounter = 0;
    adapter = new SplitsAdapter();
    wallet = mockWalletClient();
    client = mockPublicClient();
  });

  it("has correct metadata", () => {
    expect(adapter.name).toBe("splits");
    expect(adapter.model).toBe("split-contract");
    expect(adapter.supportedChains).toContain(CHAIN_IDS.BASE);
    expect(adapter.supportedChains).toContain(CHAIN_IDS.ETHEREUM);
    expect(adapter.supportedChains).not.toContain(CHAIN_IDS.AVALANCHE);
  });

  it("creates a split and sends native ETH", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 6000 },
      { entityId: BOB, bps: 4000 },
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 10000n,
      token: zeroAddress,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
    });

    expect(result.success).toBe(true);
    expect(result.adapter).toBe("splits");
    expect(result.model).toBe("split-contract");
    // 1 tx for createSplit + 1 tx for sending ETH
    expect(result.txHashes).toHaveLength(2);
    expect(result.data?.splitAddress).toBeDefined();
    expect(result.data?.immutable).toBe(true);
  });

  it("creates a split and sends ERC-20 tokens", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 1000n,
      token: TOKEN,
      chainId: CHAIN_IDS.ETHEREUM,
      walletClient: wallet,
      publicClient: client,
    });

    expect(result.success).toBe(true);
    expect(result.txHashes).toHaveLength(2);
  });

  it("creates only the split when amount is zero", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 0n,
      token: zeroAddress,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
    });

    expect(result.success).toBe(true);
    // Only 1 tx for createSplit, no transfer needed
    expect(result.txHashes).toHaveLength(1);
  });

  it("respects immutable=false and controller options", async () => {
    const CONTROLLER = getAddress("0x0000000000000000000000000000000000001111");
    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 100n,
      token: zeroAddress,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
      options: { immutable: false, controller: CONTROLLER },
    });

    expect(result.data?.immutable).toBe(false);
    expect(result.data?.controller).toBe(CONTROLLER);
  });

  it("throws on unsupported chain", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: zeroAddress,
        chainId: 99999,
        walletClient: wallet,
        publicClient: client,
      })
    ).rejects.toThrow(PaymentError);

    try {
      await adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: zeroAddress,
        chainId: 99999,
        walletClient: wallet,
        publicClient: client,
      });
    } catch (e) {
      expect((e as PaymentError).code).toBe("UNSUPPORTED_CHAIN");
    }
  });

  it("throws on empty distribution", async () => {
    const dist = makeDistribution([]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: zeroAddress,
        chainId: CHAIN_IDS.BASE,
        walletClient: wallet,
        publicClient: client,
      })
    ).rejects.toThrow(PaymentError);
  });

  it("throws when fewer than 2 recipients", async () => {
    const dist = makeDistribution([{ entityId: ALICE, bps: 10000 }]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: zeroAddress,
        chainId: CHAIN_IDS.BASE,
        walletClient: wallet,
        publicClient: client,
      })
    ).rejects.toThrow("at least 2 recipients");
  });

  it("converts bps to splits scale correctly", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 7000 }, // 70%
      { entityId: BOB, bps: 3000 }, // 30%
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 10000n,
      token: zeroAddress,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
    });

    // Payment entries should reflect correct bps conversion back
    const alicePayment = result.payments.find((p) => p.bps === 7000);
    expect(alicePayment).toBeDefined();
    // 70% of 10000 = 7000
    expect(alicePayment!.amount).toBe(7000n);
  });

  it("estimates fees for split creation", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    const estimate = await adapter.estimateFees({
      distribution: dist,
      amount: 1000n,
      token: zeroAddress,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
    });

    expect(estimate.txCount).toBe(2); // create + transfer
    // (150k + 65k) gas * 1 gwei
    expect(estimate.gasEstimate).toBe(215_000n * 1_000_000_000n);
  });

  it("estimates 1 tx when amount is zero", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    const estimate = await adapter.estimateFees({
      distribution: dist,
      amount: 0n,
      token: zeroAddress,
      chainId: CHAIN_IDS.BASE,
      walletClient: wallet,
      publicClient: client,
    });

    expect(estimate.txCount).toBe(1); // only create
  });

  it("supportsToken always returns true", async () => {
    expect(await adapter.supportsToken(TOKEN, CHAIN_IDS.BASE)).toBe(true);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | SuperfluidAdapter                                            |
\*─────────────────────────────────────────────────────────────*/

describe("SuperfluidAdapter", () => {
  let adapter: SuperfluidAdapter;
  let wallet: WalletClient;
  let superTokenClient: PublicClient;

  beforeEach(() => {
    txCounter = 0;
    adapter = new SuperfluidAdapter();
    wallet = mockWalletClient();
    // Mock a client where the token IS a SuperToken (getHost returns an address)
    superTokenClient = mockPublicClient({
      readContract: vi.fn().mockImplementation(({ functionName }) => {
        if (functionName === "getHost")
          return Promise.resolve(
            "0x2222222222222222222222222222222222222222"
          );
        if (functionName === "getFlowrate") return Promise.resolve(0n);
        return Promise.resolve(10n ** 18n);
      }),
    });
  });

  it("has correct metadata", () => {
    expect(adapter.name).toBe("superfluid");
    expect(adapter.model).toBe("streaming");
    expect(adapter.supportedChains).toContain(CHAIN_IDS.POLYGON);
    expect(adapter.supportedChains).toContain(CHAIN_IDS.BASE);
  });

  it("creates streams for multiple recipients", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 6000 },
      { entityId: BOB, bps: 4000 },
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 10000n,
      token: TOKEN,
      chainId: CHAIN_IDS.POLYGON,
      walletClient: wallet,
      publicClient: superTokenClient,
      options: { streamDuration: 1000 },
    });

    expect(result.success).toBe(true);
    expect(result.adapter).toBe("superfluid");
    expect(result.model).toBe("streaming");
    expect(result.payments).toHaveLength(2);
    expect(result.txHashes).toHaveLength(2);
    expect(result.data?.streamDuration).toBe(1000);
    expect(result.data?.flowRates).toBeDefined();
  });

  it("calculates correct flow rates", async () => {
    const dist = makeDistribution([{ entityId: ALICE, bps: 10000 }]);
    const amount = 2_592_000n; // exactly 1 token/second for 30 days
    const streamDuration = 2_592_000; // 30 days

    const result = await adapter.distribute({
      distribution: dist,
      amount,
      token: TOKEN,
      chainId: CHAIN_IDS.POLYGON,
      walletClient: wallet,
      publicClient: superTokenClient,
      options: { streamDuration },
    });

    expect(result.success).toBe(true);
    // Flow rate should be 1 per second
    const flowRates = result.data?.flowRates as Array<{
      flowRate: string;
    }>;
    expect(flowRates[0].flowRate).toBe("1");
  });

  it("skips zero-flowrate entries", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 9999 },
      { entityId: BOB, bps: 1 }, // 0.01%
    ]);

    // Bob's share: (10000 * 1) / 10000 = 1
    // flowRate = 1 / 2592000 = 0 (integer division) → zero flowrate
    const result = await adapter.distribute({
      distribution: dist,
      amount: 10000n,
      token: TOKEN,
      chainId: CHAIN_IDS.POLYGON,
      walletClient: wallet,
      publicClient: superTokenClient,
      options: { streamDuration: 2_592_000 }, // 30 days
    });

    const bobPayment = result.payments.find((p) => p.recipient === BOB);
    expect(bobPayment?.success).toBe(false);
    expect(bobPayment?.error).toContain("Flow rate would be zero");
  });

  it("throws on unsupported chain", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: TOKEN,
        chainId: 99999,
        walletClient: wallet,
        publicClient: superTokenClient,
      })
    ).rejects.toThrow(PaymentError);

    try {
      await adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: TOKEN,
        chainId: 99999,
        walletClient: wallet,
        publicClient: superTokenClient,
      });
    } catch (e) {
      expect((e as PaymentError).code).toBe("UNSUPPORTED_CHAIN");
    }
  });

  it("throws on non-SuperToken", async () => {
    // Mock a client where getHost fails (not a SuperToken)
    const nonSuperClient = mockPublicClient({
      readContract: vi.fn().mockRejectedValue(new Error("not a contract")),
    });

    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: TOKEN,
        chainId: CHAIN_IDS.POLYGON,
        walletClient: wallet,
        publicClient: nonSuperClient,
      })
    ).rejects.toThrow("SuperToken");
  });

  it("throws on empty distribution", async () => {
    const dist = makeDistribution([]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 100n,
        token: TOKEN,
        chainId: CHAIN_IDS.POLYGON,
        walletClient: wallet,
        publicClient: superTokenClient,
      })
    ).rejects.toThrow(PaymentError);
  });

  it("throws on zero amount", async () => {
    const dist = makeDistribution([{ entityId: ALICE, bps: 10000 }]);

    await expect(
      adapter.distribute({
        distribution: dist,
        amount: 0n,
        token: TOKEN,
        chainId: CHAIN_IDS.POLYGON,
        walletClient: wallet,
        publicClient: superTokenClient,
      })
    ).rejects.toThrow(PaymentError);
  });

  it("uses default 30-day stream duration", async () => {
    const dist = makeDistribution([{ entityId: ALICE, bps: 10000 }]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 10000n,
      token: TOKEN,
      chainId: CHAIN_IDS.POLYGON,
      walletClient: wallet,
      publicClient: superTokenClient,
    });

    expect(result.data?.streamDuration).toBe(30 * 24 * 60 * 60);
  });

  it("estimates fees per stream", async () => {
    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    const estimate = await adapter.estimateFees({
      distribution: dist,
      amount: 1000n,
      token: TOKEN,
      chainId: CHAIN_IDS.POLYGON,
      walletClient: wallet,
      publicClient: superTokenClient,
    });

    expect(estimate.txCount).toBe(2);
    // 2 streams * 250k gas * 1 gwei
    expect(estimate.gasEstimate).toBe(500_000n * 1_000_000_000n);
  });

  it("supportsToken returns true for SuperTokens", async () => {
    const result = await adapter.supportsToken(
      TOKEN,
      CHAIN_IDS.POLYGON,
      superTokenClient
    );
    expect(result).toBe(true);
  });

  it("supportsToken returns false for non-SuperTokens", async () => {
    const nonSuperClient = mockPublicClient({
      readContract: vi.fn().mockRejectedValue(new Error("not a contract")),
    });

    const result = await adapter.supportsToken(
      TOKEN,
      CHAIN_IDS.POLYGON,
      nonSuperClient
    );
    expect(result).toBe(false);
  });

  it("supportsToken returns false for unsupported chain", async () => {
    const result = await adapter.supportsToken(TOKEN, 99999);
    expect(result).toBe(false);
  });

  it("continues after individual stream creation failure", async () => {
    let callCount = 0;
    const flakeyWallet = {
      getAddresses: vi.fn().mockResolvedValue([SENDER]),
      sendTransaction: vi.fn().mockImplementation(() => {
        if (++callCount === 1) return Promise.reject(new Error("gas too low"));
        return Promise.resolve(`0xtx${callCount}` as `0x${string}`);
      }),
    } as unknown as WalletClient;

    const dist = makeDistribution([
      { entityId: ALICE, bps: 5000 },
      { entityId: BOB, bps: 5000 },
    ]);

    const result = await adapter.distribute({
      distribution: dist,
      amount: 2_592_000_000n,
      token: TOKEN,
      chainId: CHAIN_IDS.POLYGON,
      walletClient: flakeyWallet,
      publicClient: superTokenClient,
      options: { streamDuration: 1000 },
    });

    expect(result.success).toBe(false);
    expect(result.payments[0].success).toBe(false);
    expect(result.payments[0].error).toBe("gas too low");
    expect(result.payments[1].success).toBe(true);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | PaymentError                                                 |
\*─────────────────────────────────────────────────────────────*/

describe("PaymentError", () => {
  it("has correct properties", () => {
    const err = new PaymentError("test", "ADAPTER_ERROR", { foo: "bar" });
    expect(err.message).toBe("test");
    expect(err.code).toBe("ADAPTER_ERROR");
    expect(err.name).toBe("PaymentError");
    expect(err.details).toEqual({ foo: "bar" });
    expect(err instanceof Error).toBe(true);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Constants                                                    |
\*─────────────────────────────────────────────────────────────*/

describe("Constants", () => {
  it("NATIVE_TOKEN is zero address", () => {
    expect(NATIVE_TOKEN).toBe(
      "0x0000000000000000000000000000000000000000"
    );
  });

  it("CHAIN_IDS has expected values", () => {
    expect(CHAIN_IDS.ETHEREUM).toBe(1);
    expect(CHAIN_IDS.BASE).toBe(8453);
    expect(CHAIN_IDS.POLYGON).toBe(137);
    expect(CHAIN_IDS.SEPOLIA).toBe(11155111);
  });
});
