import React from "react";
import { Zap, Bot, Shield } from "lucide-react";
import { Timestamp } from "../primitives/timestamp";
import { getAIToolSafe, getVerificationSafe } from "../../lib/extensions";
import type { Action } from "@provenancekit/eaa-types";

interface TrackerActionItemProps {
  action: Action;
  isLatest?: boolean;
  isLast?: boolean;
  className?: string;
}

function formatActionType(t: string): string {
  return t.replace(/^ext:/, "").replace(/@[\d.]+$/, "").replace(/-/g, " ");
}

export function TrackerActionItem({ action, isLatest, isLast, className }: TrackerActionItemProps) {
  const aiTool = getAIToolSafe(action);
  const verification = getVerificationSafe(action);
  const isVerified = verification?.status === "verified";

  const dotColor = isLatest ? "#22c55e" : "var(--pk-surface-border, #e2e8f0)";
  const dotBorder = isLatest ? "#22c55e" : "var(--pk-surface-border, #e2e8f0)";

  return (
    <div
      className={className}
      style={{ display: "flex", gap: 12, paddingBottom: isLast ? 0 : 0 }}
    >
      {/* Timeline column */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24, flexShrink: 0 }}>
        {/* Dot */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: isLatest ? "rgba(34,197,94,0.12)" : "var(--pk-surface-muted, #f8fafc)",
            border: `2px solid ${dotBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            zIndex: 1,
          }}
        >
          <Zap
            size={11}
            strokeWidth={2.5}
            style={{ color: isLatest ? "#22c55e" : "var(--pk-muted-foreground, #94a3b8)" }}
          />
        </div>
        {/* Line (hidden for last item) */}
        {!isLast && (
          <div
            style={{
              width: 1.5,
              flex: 1,
              background: "var(--pk-surface-border, #e2e8f0)",
              marginTop: 2,
              minHeight: 16,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 8 : 16, minWidth: 0 }}>
        {/* Action type + badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--pk-foreground, #0f172a)",
              textTransform: "capitalize",
            }}
          >
            {formatActionType(action.type)}
          </span>

          {isLatest && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 999,
                background: "rgba(34,197,94,0.12)",
                color: "#16a34a",
                border: "1px solid rgba(34,197,94,0.3)",
              }}
            >
              Latest
            </span>
          )}

          {aiTool && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "#7c3aed",
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: 6,
                padding: "1px 7px",
              }}
            >
              <Bot size={9} strokeWidth={2} />
              {aiTool.provider}{aiTool.model ? ` · ${aiTool.model}` : ""}
            </span>
          )}

          {isVerified && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "#059669",
                background: "rgba(5,150,105,0.08)",
                border: "1px solid rgba(5,150,105,0.2)",
                borderRadius: 6,
                padding: "1px 7px",
              }}
            >
              <Shield size={9} strokeWidth={2} />
              Verified
            </span>
          )}
        </div>

        {/* Timestamp */}
        <div style={{ fontSize: 11, color: "var(--pk-muted-foreground, #64748b)" }}>
          <Timestamp iso={action.timestamp} />
          {action.outputs.length > 0 && (
            <span style={{ marginLeft: 8 }}>
              → {action.outputs.length} output{action.outputs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
