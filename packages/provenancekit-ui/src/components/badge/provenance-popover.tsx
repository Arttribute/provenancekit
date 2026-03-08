"use client";

import React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ExternalLink } from "lucide-react";
import { Timestamp } from "../primitives/timestamp";
import { CidDisplay } from "../primitives/cid-display";
import {
  getLicenseSafe,
  getAIToolSafe,
  getVerificationSafe,
  getPrimaryCreator,
} from "../../lib/extensions";
import type { ProvenanceBundle } from "@provenancekit/sdk";

interface ProvenancePopoverProps {
  bundle: ProvenanceBundle;
  cid?: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  onViewDetail?: () => void;
}

// Matches C2PA "Content Credentials" row: bold label + inline value, separated by <hr>
function CredRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 0" }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: "1.5", color: "#111827" }}>
        <strong style={{ fontWeight: 700 }}>{label}</strong>{" "}
        <span style={{ color: "#374151" }}>{value}</span>
      </p>
    </div>
  );
}

const Divider = () => (
  <div style={{ height: 1, background: "#f3f4f6", margin: 0 }} />
);

export function ProvenancePopover({
  bundle,
  cid,
  children,
  side = "bottom",
  onViewDetail,
}: ProvenancePopoverProps) {
  const creator = getPrimaryCreator(bundle.attributions, bundle.entities);
  const primaryAction = bundle.actions[bundle.actions.length - 1];
  const primaryResource = bundle.resources.find(
    (r) => r.address?.ref === cid || !cid
  ) ?? bundle.resources[0];

  const license = primaryResource ? getLicenseSafe(primaryResource) : null;
  const aiTool = primaryAction ? getAIToolSafe(primaryAction) : null;
  const verification = primaryAction ? getVerificationSafe(primaryAction) : null;

  const toolLabel = aiTool
    ? `${aiTool.provider}${aiTool.model ? ` ${aiTool.model}` : ""}`
    : null;

  const verifiedLabel =
    verification?.status === "verified"
      ? (verification.policyUsed ?? "Verified")
      : verification?.status === "partial"
      ? "Partially verified"
      : null;

  const rows: { label: string; value: React.ReactNode }[] = [];
  if (primaryAction?.timestamp) {
    rows.push({ label: "Date", value: <Timestamp iso={primaryAction.timestamp} /> });
  }
  if (creator) {
    rows.push({ label: "Produced by", value: creator.name ?? creator.id });
  }
  if (toolLabel) {
    rows.push({ label: "App or tool used", value: toolLabel });
  }
  if (license?.type) {
    rows.push({ label: "License", value: license.type });
  }
  if (verifiedLabel) {
    rows.push({ label: "Signed with", value: verifiedLabel });
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align="end"
          sideOffset={10}
          style={{
            width: 320,
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
            border: "1px solid rgba(0,0,0,0.08)",
            zIndex: 9999,
            overflow: "hidden",
            outline: "none",
          }}
        >
          {/* Header — matches C2PA "Content Credentials" */}
          <div style={{ padding: "16px 20px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              {/* Pr squircle — mini version in header */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "28%",
                  background: "oklch(0.12 0.04 250)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    color: "#fff",
                    fontFamily: "var(--pk-badge-font-family, 'Red Hat Display', system-ui, sans-serif)",
                  }}
                >
                  Pr
                </span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>
                  Provenance
                </p>
                {cid && (
                  <div style={{ marginTop: 2 }}>
                    <CidDisplay cid={cid} prefixLen={10} suffixLen={6} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Credential rows — C2PA style */}
          {rows.length > 0 && (
            <div style={{ padding: "0 20px", borderTop: "1px solid #f3f4f6" }}>
              {rows.map((row, i) => (
                <React.Fragment key={row.label}>
                  <CredRow label={row.label} value={row.value} />
                  {i < rows.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Footer CTA */}
          {onViewDetail && (
            <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #f3f4f6" }}>
              <button
                type="button"
                onClick={onViewDetail}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "oklch(0.12 0.04 250)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                }}
              >
                View full provenance
                <ExternalLink size={11} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
