import { cn } from "@/lib/utils";
import { getChainName, isTestnet, getExplorerUrl } from "@/lib/chains";
import { ExternalLink, Radio } from "lucide-react";
import Link from "next/link";

interface NetworkBadgeProps {
  chainId: number;
  chainName?: string | null;
  contractAddress?: string | null;
  /** Show a link to the contract on the block explorer */
  showExplorer?: boolean;
  className?: string;
}

/**
 * Displays which network (chain) provenance is being recorded on.
 *
 * - Testnets: amber/orange badge with "Testnet" label
 * - Mainnets: green badge with chain name
 * - Custom/unknown chains: neutral badge with Chain ID
 */
export function NetworkBadge({
  chainId,
  chainName,
  contractAddress,
  showExplorer = false,
  className,
}: NetworkBadgeProps) {
  const name = getChainName(chainId, chainName ?? undefined);
  const testnet = isTestnet(chainId);
  const explorerUrl = getExplorerUrl(chainId);
  const contractUrl =
    showExplorer && explorerUrl && contractAddress
      ? `${explorerUrl}/address/${contractAddress}`
      : null;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          testnet
            ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
            : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
        )}
      >
        <Radio className="h-2.5 w-2.5" />
        {name}
        {testnet && (
          <span className="ml-0.5 text-[10px] font-normal opacity-70">testnet</span>
        )}
      </span>

      {contractUrl && (
        <Link
          href={contractUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          title={`View contract on ${name}`}
        >
          <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      )}
    </div>
  );
}

/**
 * Full network status pill — shows "On-chain enabled" or "Off-chain only".
 * Used in project headers and dashboards.
 */
export function NetworkStatus({
  chainId,
  chainName,
  contractAddress,
  className,
}: NetworkBadgeProps) {
  const testnet = isTestnet(chainId);
  const name = getChainName(chainId, chainName ?? undefined);
  const explorerUrl = getExplorerUrl(chainId);
  const contractUrl =
    explorerUrl && contractAddress
      ? `${explorerUrl}/address/${contractAddress}`
      : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        testnet
          ? "bg-amber-50/50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300"
          : "bg-emerald-50/50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300",
        className
      )}
    >
      <Radio className="h-3 w-3 shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="font-semibold">
          {name}
          {testnet && <span className="font-normal opacity-70 ml-1">· testnet</span>}
        </span>
        {contractAddress && (
          <span className="font-mono text-[10px] opacity-70 truncate">
            {contractAddress.slice(0, 10)}…{contractAddress.slice(-6)}
          </span>
        )}
      </div>
      {contractUrl && (
        <Link
          href={contractUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          title="View contract on explorer"
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
