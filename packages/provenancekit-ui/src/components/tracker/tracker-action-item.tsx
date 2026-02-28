import React from "react";
import { Zap, Bot, CheckCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { Timestamp } from "../primitives/timestamp";
import { VerificationIndicator } from "../primitives/verification-indicator";
import { getAIToolSafe, getVerificationSafe } from "../../lib/extensions";
import { formatActionType } from "../../lib/format";
import type { Action } from "@provenancekit/eaa-types";

interface TrackerActionItemProps {
  action: Action;
  isLatest?: boolean;
  className?: string;
}

export function TrackerActionItem({ action, isLatest, className }: TrackerActionItemProps) {
  const aiTool = getAIToolSafe(action);
  const verification = getVerificationSafe(action);

  return (
    <div className={cn("flex gap-3", className)}>
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "size-6 rounded-full flex items-center justify-center shrink-0",
            "border-2",
            isLatest
              ? "border-[var(--pk-node-action)] bg-[var(--pk-node-action-muted)]"
              : "border-[var(--pk-surface-border)] bg-[var(--pk-surface)]"
          )}
        >
          <Zap
            size={11}
            strokeWidth={2}
            className={isLatest ? "text-[var(--pk-node-action)]" : "text-[var(--pk-muted-foreground)]"}
          />
        </div>
        <div className="w-px flex-1 bg-[var(--pk-surface-border)] mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--pk-foreground)]">
            {formatActionType(action.type)}
          </span>
          {aiTool && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--pk-role-ai)]">
              <Bot size={10} strokeWidth={2} />
              {aiTool.provider} {aiTool.model}
            </span>
          )}
          {verification && <VerificationIndicator status={verification.status} size="sm" />}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <Timestamp iso={action.timestamp} />
          {action.outputs.length > 0 && (
            <span className="text-xs text-[var(--pk-muted-foreground)]">
              → {action.outputs.length} output{action.outputs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
