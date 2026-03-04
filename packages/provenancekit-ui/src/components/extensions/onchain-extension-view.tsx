import React from "react";
import { Link, CheckCircle, Clock } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatTxHash, formatChainName, formatDate } from "../../lib/format";
import type { OnchainExtension } from "../../lib/extensions";

interface OnchainExtensionViewProps {
  extension: OnchainExtension;
  className?: string;
}

export function OnchainExtensionView({ extension, className }: OnchainExtensionViewProps) {
  const chainName = extension.chainName ?? formatChainName(extension.chainId);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Link size={12} strokeWidth={2} className="text-[var(--pk-node-resource)]" />
        <span className="text-xs font-semibold text-[var(--pk-foreground)]">On-chain</span>
        {extension.confirmed && (
          <CheckCircle size={10} strokeWidth={2} className="text-[var(--pk-verified)]" />
        )}
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[var(--pk-muted-foreground)] min-w-[60px]">Chain</span>
          <span className="font-medium text-[var(--pk-foreground)]">{chainName}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[var(--pk-muted-foreground)] min-w-[60px]">Block</span>
          <span className="font-medium text-[var(--pk-foreground)] tabular-nums">
            #{extension.blockNumber.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[var(--pk-muted-foreground)] min-w-[60px]">Tx</span>
          <span
            className="font-mono text-xs text-[var(--pk-foreground)]"
            title={extension.transactionHash}
          >
            {formatTxHash(extension.transactionHash)}
          </span>
        </div>

        {extension.blockTimestamp && (
          <div className="flex items-center gap-1 text-[var(--pk-muted-foreground)]">
            <Clock size={10} />
            <span>{formatDate(extension.blockTimestamp)}</span>
          </div>
        )}

        {extension.confirmations != null && (
          <div className="text-[var(--pk-muted-foreground)]">
            {extension.confirmations} confirmation{extension.confirmations !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
