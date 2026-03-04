"use client";

import React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ExternalLink, Bot } from "lucide-react";
import { cn } from "../../lib/utils";
import { EntityAvatar } from "../primitives/entity-avatar";
import { LicenseChip } from "../primitives/license-chip";
import { VerificationIndicator } from "../primitives/verification-indicator";
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
  showGraph?: boolean;
}

export function ProvenancePopover({
  bundle,
  cid,
  children,
  side = "bottom",
  onViewDetail,
  showGraph,
}: ProvenancePopoverProps) {
  const creator = getPrimaryCreator(bundle.attributions, bundle.entities);
  const primaryAction = bundle.actions[bundle.actions.length - 1];
  const primaryResource = bundle.resources.find(
    (r) => r.address?.ref === cid || !cid
  ) ?? bundle.resources[0];

  const license = primaryResource ? getLicenseSafe(primaryResource) : null;
  const aiTool = primaryAction ? getAIToolSafe(primaryAction) : null;
  const verification = primaryAction ? getVerificationSafe(primaryAction) : null;

  const usedAI = aiTool !== null || bundle.actions.some((a) => getAIToolSafe(a) !== null);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 w-72 rounded-xl shadow-xl outline-none",
            "bg-[var(--pk-surface)] border border-[var(--pk-surface-border)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
          )}
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-[var(--pk-surface-border)]">
            <div className="flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-[var(--pk-node-resource)] shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--pk-muted-foreground)]">
                Provenance
              </span>
            </div>
            {cid && (
              <div className="mt-1">
                <CidDisplay cid={cid} prefixLen={10} suffixLen={6} />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-4 py-3 space-y-3">
            {/* Creator */}
            {creator && (
              <div className="flex items-center gap-2.5">
                <EntityAvatar role={creator.role ?? "human"} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--pk-foreground)] truncate">
                    {creator.name ?? creator.id}
                  </p>
                  <p className="text-xs text-[var(--pk-muted-foreground)] capitalize">
                    {creator.role}
                  </p>
                </div>
              </div>
            )}

            {/* Creation date */}
            {primaryAction?.timestamp && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--pk-muted-foreground)]">Created</span>
                <Timestamp iso={primaryAction.timestamp} />
              </div>
            )}

            {/* AI disclosure */}
            {usedAI && (
              <div className="flex items-center gap-1.5 text-[var(--pk-role-ai)]">
                <Bot size={12} strokeWidth={2} />
                <span className="text-xs">
                  {aiTool ? `${aiTool.provider} ${aiTool.model}` : "AI-assisted"}
                </span>
              </div>
            )}

            {/* License */}
            {license && (
              <div className="flex items-center gap-1.5">
                <LicenseChip license={license} />
              </div>
            )}

            {/* Verification status */}
            {verification && (
              <div className="flex items-center gap-1.5">
                <VerificationIndicator status={verification.status} showLabel size="sm" />
              </div>
            )}
          </div>

          {/* Footer */}
          {onViewDetail && (
            <div className="px-4 pb-4 pt-1">
              <button
                type="button"
                onClick={onViewDetail}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium",
                  "bg-[var(--pk-node-resource)]/10 text-[var(--pk-node-resource)]",
                  "hover:bg-[var(--pk-node-resource)]/20 transition-colors"
                )}
              >
                View full provenance
                <ExternalLink size={11} strokeWidth={2} />
              </button>
            </div>
          )}

          <Popover.Arrow className="fill-[var(--pk-surface-border)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
