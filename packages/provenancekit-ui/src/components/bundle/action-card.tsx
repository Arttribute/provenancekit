"use client";

import React from "react";
import { Zap, Bot, Clock, Shield } from "lucide-react";
import { Timestamp } from "../primitives/timestamp";
import { getAIToolSafe, getVerificationSafe } from "../../lib/extensions";
import type { Action } from "@provenancekit/eaa-types";

interface ActionCardProps {
  action: Action;
}

function formatActionType(t: string): string {
  return t.replace(/^ext:/, "").replace(/@[\d.]+$/, "").replace(/-/g, " ").replace(/\//g, " · ");
}

export function ActionCard({ action }: ActionCardProps) {
  const aiTool = getAIToolSafe(action);
  const verification = getVerificationSafe(action);
  const isVerified = verification?.status === "verified";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(34,197,94,0.2)",
        borderRadius: 12,
        overflow: "hidden",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(34,197,94,0.1)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      {/* Green accent top bar */}
      <div style={{ height: 3, background: "#22c55e" }} />

      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* Icon */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "rgba(34,197,94,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Zap size={16} color="#22c55e" strokeWidth={2} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Action type */}
            {action.type && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#22c55e",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                {formatActionType(action.type)}
              </div>
            )}

            {/* Timestamp */}
            {action.timestamp && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                <Clock size={11} color="#94a3b8" />
                <Timestamp iso={action.timestamp} />
              </div>
            )}

            {/* AI tool */}
            {aiTool && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  color: "#7c3aed",
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.2)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  marginTop: 2,
                }}
              >
                <Bot size={10} />
                {aiTool.provider}{aiTool.model ? ` · ${aiTool.model}` : ""}
              </div>
            )}

            {/* Verification badge */}
            {isVerified && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  color: "#059669",
                  background: "rgba(5,150,105,0.08)",
                  border: "1px solid rgba(5,150,105,0.2)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  marginTop: 4,
                  marginLeft: aiTool ? 6 : 0,
                }}
              >
                <Shield size={10} />
                {verification?.policyUsed ?? "Verified"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
