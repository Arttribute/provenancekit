"use client";

import React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ExternalLink, Bot, Calendar, User, Shield, Tag } from "lucide-react";
import { cn } from "../../lib/utils";
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

// A single labeled row in the credentials card — matches C2PA's "Date / Produced by / App used" layout
function CredentialRow({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--pk-surface-border)] last:border-0">
      <div className="flex items-center gap-2 w-[108px] shrink-0">
        <Icon size={12} strokeWidth={2} className="text-[var(--pk-muted-foreground)] shrink-0" />
        <span className="text-xs font-semibold text-[var(--pk-foreground)]">{label}</span>
      </div>
      <div className={cn("text-xs text-[var(--pk-muted-foreground)] min-w-0 flex-1", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

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

  // Determine what "app or tool used" is
  const toolLabel = aiTool
    ? `${aiTool.provider}${aiTool.model ? ` ${aiTool.model}` : ""}`
    : null;

  // Verification label
  const verifiedLabel =
    verification?.status === "verified"
      ? verification.policyUsed ?? "Verified"
      : verification?.status === "partial"
      ? "Partially verified"
      : null;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align="end"
          sideOffset={10}
          className={cn(
            "z-50 w-[300px] rounded-2xl shadow-2xl outline-none overflow-hidden",
            "bg-[var(--pk-surface)] border border-[var(--pk-surface-border)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
            "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2"
          )}
        >
          {/* Header — matches C2PA "Content Credentials" header with logo */}
          <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
            {/* "Pr" logo mark — same squircle as the badge */}
            <div
              className="flex items-center justify-center shrink-0 bg-[var(--pk-badge-bg)] text-[var(--pk-badge-fg)] border border-[var(--pk-badge-border)] w-[26px] h-[26px]"
              style={{ borderRadius: "28%" }}
            >
              <span
                className="text-[11px] font-bold leading-none select-none"
                style={{ fontFamily: "var(--pk-badge-font-family, 'Red Hat Display', system-ui, sans-serif)" }}
              >Pr</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--pk-foreground)] leading-tight">
                Provenance
              </p>
              {cid && (
                <div className="mt-0.5">
                  <CidDisplay cid={cid} prefixLen={8} suffixLen={5} />
                </div>
              )}
            </div>
          </div>

          {/* Credential rows */}
          <div className="px-4 border-t border-[var(--pk-surface-border)]">
            {/* Date */}
            {primaryAction?.timestamp && (
              <CredentialRow
                icon={Calendar}
                label="Date"
                value={<Timestamp iso={primaryAction.timestamp} />}
              />
            )}

            {/* Produced by */}
            {creator && (
              <CredentialRow
                icon={User}
                label="Produced by"
                value={
                  <span className="truncate block">{creator.name ?? creator.id}</span>
                }
              />
            )}

            {/* App or tool used */}
            {toolLabel && (
              <CredentialRow
                icon={Bot}
                label="App or tool used"
                value={<span className="truncate block">{toolLabel}</span>}
              />
            )}

            {/* License */}
            {license?.type && (
              <CredentialRow
                icon={Tag}
                label="License"
                value={<span className="font-mono">{license.type}</span>}
              />
            )}

            {/* Signed with / verified */}
            {verifiedLabel && (
              <CredentialRow
                icon={Shield}
                label="Signed with"
                value={<span>{verifiedLabel}</span>}
                valueClassName="text-[var(--pk-verified)]"
              />
            )}
          </div>

          {/* Footer CTA */}
          {onViewDetail && (
            <div className="px-4 pt-3 pb-4">
              <button
                type="button"
                onClick={onViewDetail}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold",
                  "bg-[var(--pk-badge-bg)] text-[var(--pk-badge-fg)]",
                  "hover:opacity-90 transition-opacity"
                )}
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
