import { Chain } from "viem";

export const baseSepolia = {
  id: 84_532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Base Sepolia ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL as string] },
    public: { http: [process.env.NEXT_PUBLIC_RPC_URL as string] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
} as const satisfies Chain;
