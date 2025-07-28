"use client";

import { createWalletClient, custom } from "viem";
import { useEffect, useState } from "react";
import { baseSepolia } from "@/lib/base-sepolia";

/**
 * Convert an EIP‑1193 provider (e.g. from Privy) into a viem WalletClient.
 */
export function useViemWalletClient(eip1193Provider: any | null) {
  const [walletClient, setWalletClient] = useState<ReturnType<
    typeof createWalletClient
  > | null>(null);

  useEffect(() => {
    if (!eip1193Provider) {
      setWalletClient(null);
      return;
    }

    setWalletClient(
      createWalletClient({
        chain: baseSepolia,
        transport: custom(eip1193Provider),
      })
    );
  }, [eip1193Provider]);

  return walletClient;
}
