import React from "react";
import { Zap } from "lucide-react";
import { cn } from "../../lib/utils";
import { Timestamp } from "../primitives/timestamp";
import { CidDisplay } from "../primitives/cid-display";
import { VerificationIndicator } from "../primitives/verification-indicator";
import { AIExtensionView } from "../extensions/ai-extension-view";
import { VerificationView } from "../extensions/verification-view";
import { OnchainExtensionView } from "../extensions/onchain-extension-view";
import { getAIToolSafe, getVerificationSafe, getOnchainSafe } from "../../lib/extensions";
import { formatActionType } from "../../lib/format";
import type { Action } from "@provenancekit/eaa-types";

interface ActionCardProps {
  action: Action;
  showExtensions?: boolean;
  className?: string;
}

export function ActionCard({ action, showExtensions = true, className }: ActionCardProps) {
  const aiTool = getAIToolSafe(action);
  const verification = getVerificationSafe(action);
  const onchain = getOnchainSafe(action as any);

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--pk-node-action-border)]",
        "bg-[var(--pk-node-action-muted)] p-3 space-y-2",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Zap size={13} strokeWidth={2} className="text-[var(--pk-node-action)] shrink-0" />
          <span className="text-sm font-semibold text-[var(--pk-foreground)] truncate">
            {formatActionType(action.type)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {verification && <VerificationIndicator status={verification.status} size="sm" />}
          <Timestamp iso={action.timestamp} />
        </div>
      </div>

      {/* Action ID */}
      <CidDisplay cid={action.id} prefixLen={8} suffixLen={4} />

      {/* I/O summary */}
      {((action.inputs?.length ?? 0) > 0 || (action.outputs?.length ?? 0) > 0) && (
        <div className="text-xs text-[var(--pk-muted-foreground)] flex gap-3">
          {(action.inputs?.length ?? 0) > 0 && (
            <span>{action.inputs!.length} input{action.inputs!.length !== 1 ? "s" : ""}</span>
          )}
          {(action.outputs?.length ?? 0) > 0 && (
            <span>{action.outputs!.length} output{action.outputs!.length !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}

      {/* Extensions */}
      {showExtensions && (
        <div className="space-y-2">
          {aiTool && (
            <div className="border-t border-[var(--pk-surface-border)] pt-2">
              <AIExtensionView extension={aiTool} mode="tool" />
            </div>
          )}
          {verification && (
            <div className="border-t border-[var(--pk-surface-border)] pt-2">
              <VerificationView extension={verification} showClaims={false} />
            </div>
          )}
          {onchain && (
            <div className="border-t border-[var(--pk-surface-border)] pt-2">
              <OnchainExtensionView extension={onchain} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
