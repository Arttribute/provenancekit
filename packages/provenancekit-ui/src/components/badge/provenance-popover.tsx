"use client";

import React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ExternalLink } from "lucide-react";
import { Timestamp } from "../primitives/timestamp";
import {
  getLicenseSafe,
  getAIToolSafe,
  getVerificationSafe,
  getPrimaryCreator,
} from "../../lib/extensions";
import type { ProvenanceBundle } from "@provenancekit/sdk";
import type { AIToolExtension } from "../../lib/extensions";

interface ProvenancePopoverProps {
  bundle: ProvenanceBundle;
  cid?: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  onViewDetail?: () => void;
}

function formatProvider(provider: string): string {
  const map: Record<string, string> = {
    "anthropic": "Anthropic",
    "openai": "OpenAI",
    "google": "Google",
    "black-forest-labs": "Black Forest Labs",
    "mistral": "Mistral",
    "meta": "Meta",
    "cohere": "Cohere",
    "stability-ai": "Stability AI",
  };
  return map[provider.toLowerCase()] ?? provider;
}

function getUniqueAITools(bundle: ProvenanceBundle): AIToolExtension[] {
  const seen = new Set<string>();
  const tools: AIToolExtension[] = [];
  for (const action of bundle.actions) {
    const tool = getAIToolSafe(action);
    if (!tool) continue;
    const key = `${tool.provider}:${tool.model ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      tools.push(tool);
    }
  }
  return tools;
}

function findLicense(bundle: ProvenanceBundle) {
  // Search resources from the end — the final output typically carries the license
  for (let i = bundle.resources.length - 1; i >= 0; i--) {
    const lic = getLicenseSafe(bundle.resources[i]!);
    if (lic) return lic;
  }
  return null;
}

function findVerification(bundle: ProvenanceBundle) {
  for (let i = bundle.actions.length - 1; i >= 0; i--) {
    const v = getVerificationSafe(bundle.actions[i]!);
    if (v) return v;
  }
  return null;
}

// Credential row: small uppercase label above, value below
function CredRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ padding: "9px 0" }}>
      <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af" }}>
        {label}
      </p>
      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", lineHeight: 1.4 }}>
        {value}
      </div>
    </div>
  );
}

const Divider = () => (
  <div style={{ height: 1, background: "#f3f4f6" }} />
);

export function ProvenancePopover({
  bundle,
  cid,
  children,
  side = "bottom",
  onViewDetail,
}: ProvenancePopoverProps) {
  const creator = getPrimaryCreator(bundle.attributions, bundle.entities);
  const aiTools = getUniqueAITools(bundle);
  const license = findLicense(bundle);
  const verification = findVerification(bundle);
  const lastAction = bundle.actions[bundle.actions.length - 1];
  const otherContributors = bundle.entities.filter((e) => e.id !== creator?.id);

  const verifiedLabel =
    verification?.status === "verified"
      ? (verification.policyUsed ?? "Verified")
      : verification?.status === "partial"
      ? "Partially verified"
      : null;

  const rows: { label: string; value: React.ReactNode }[] = [];

  if (lastAction?.timestamp) {
    rows.push({ label: "Date", value: <Timestamp iso={lastAction.timestamp} /> });
  }

  if (creator) {
    const suffix = otherContributors.length > 0
      ? ` + ${otherContributors.length} more`
      : "";
    rows.push({ label: "Produced by", value: `${creator.name ?? creator.id}${suffix}` });
  }

  if (aiTools.length > 0) {
    rows.push({
      label: aiTools.length === 1 ? "AI tool used" : "AI tools used",
      value: (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {aiTools.map((t, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#7c3aed",
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              <span style={{ fontWeight: 600 }}>{formatProvider(t.provider)}</span>
              {t.model && (
                <span style={{ color: "#6b7280", fontWeight: 400 }}>· {t.model}</span>
              )}
            </span>
          ))}
        </div>
      ),
    });
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
            width: 296,
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
            border: "1px solid rgba(0,0,0,0.08)",
            zIndex: 9999,
            overflow: "hidden",
            outline: "none",
          }}
        >
          {/* Header */}
          <div style={{ padding: "13px 16px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "28%",
                  background: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
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
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>
                  Content Provenance
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af", lineHeight: 1 }}>
                  {bundle.entities.length} contributor{bundle.entities.length !== 1 ? "s" : ""} · {bundle.actions.length} action{bundle.actions.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Credential rows */}
          {rows.length > 0 && (
            <div style={{ padding: "0 16px", borderTop: "1px solid #f3f4f6" }}>
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
            <div style={{ padding: "10px 16px 14px", borderTop: "1px solid #f3f4f6" }}>
              <button
                type="button"
                onClick={onViewDetail}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 9,
                  background: "#0f172a",
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
