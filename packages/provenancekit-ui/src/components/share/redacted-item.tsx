"use client";

import React from "react";
import { EyeOff } from "lucide-react";

export interface RedactedItemProps {
  /** The display label, defaults to "REDACTED" */
  label?: string;
  /** Optional explanation for why this item is redacted */
  reason?: string;
  /** Compact inline variant (for use inside cards) vs. full-width block */
  variant?: "block" | "inline";
  /**
   * SHA-256 commitment digest from the SD document.
   * Proves this item exists in the original provenance record
   * even though its content is not disclosed.
   * Format: "sha256:<hex>"
   */
  commitment?: string;
}

/**
 * Visual indicator for a redacted provenance item.
 *
 * Redacted items are NEVER hidden — they always show this block so viewers
 * know the full structure of the provenance chain and which parts the author
 * chose not to disclose.
 */
export function RedactedItem({ label = "REDACTED", reason, commitment, variant = "block" }: RedactedItemProps) {
  if (variant === "inline") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          fontWeight: 600,
          color: "#64748b",
          background: "repeating-linear-gradient(45deg, #f1f5f9 0px, #f1f5f9 4px, #e2e8f0 4px, #e2e8f0 8px)",
          border: "1px solid #cbd5e1",
          borderRadius: 5,
          padding: "2px 7px",
          fontFamily: "monospace",
          letterSpacing: "0.04em",
        }}
        title={reason ? `Redacted: ${reason}` : "Content redacted by the author"}
      >
        <EyeOff size={9} />
        {label}
      </span>
    );
  }

  return (
    <div
      style={{
        background: "repeating-linear-gradient(45deg, #f8fafc 0px, #f8fafc 6px, #f1f5f9 6px, #f1f5f9 12px)",
        border: "1.5px dashed #cbd5e1",
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      {/* Icon container */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: "#f1f5f9",
          border: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <EyeOff size={15} color="#94a3b8" strokeWidth={2} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontFamily: "monospace",
            marginBottom: (reason || commitment) ? 4 : 0,
          }}
        >
          {label}
        </div>
        {reason && (
          <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", marginBottom: commitment ? 4 : 0 }}>
            {reason}
          </div>
        )}
        {commitment && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              color: "#94a3b8",
              fontFamily: "monospace",
              marginTop: 2,
            }}
            title="SHA-256 commitment from the SD document — proves this item exists in the original provenance record"
          >
            <span style={{ color: "#cbd5e1" }}>commitment:</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {commitment}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
