"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "../../lib/utils";
import { ProvenancePopover } from "./provenance-popover";
import { useProvenanceBundle } from "../../hooks/use-provenance-bundle";
import type { ProvenanceBundle } from "@provenancekit/sdk";

export type BadgePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type BadgeSize = "sm" | "md" | "lg";
export type BadgeVariant = "floating" | "inline";

export interface ProvenanceBadgeProps {
  /** Resource CID — auto-fetches bundle if no bundle prop provided */
  cid?: string;
  /** Pre-fetched bundle — bypasses auto-fetch */
  bundle?: ProvenanceBundle;
  /** Content to wrap (image, video, text, etc.) */
  children?: React.ReactNode;
  /** Position of the floating badge indicator */
  position?: BadgePosition;
  size?: BadgeSize;
  variant?: BadgeVariant;
  /** Popover direction */
  popoverSide?: "top" | "bottom" | "left" | "right";
  /** Called when user clicks "View Full Provenance" in the popover */
  onViewDetail?: () => void;
  loadingSlot?: React.ReactNode;
  errorSlot?: React.ReactNode;
  className?: string;
}

const positionClasses: Record<BadgePosition, string> = {
  "top-left": "top-2 left-2",
  "top-right": "top-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "bottom-right": "bottom-2 right-2",
};

const sizeClasses: Record<BadgeSize, { button: string; icon: number }> = {
  sm: { button: "size-6", icon: 12 },
  md: { button: "size-7", icon: 14 },
  lg: { button: "size-9", icon: 16 },
};

function BadgeButton({
  size,
  className,
}: {
  size: BadgeSize;
  className?: string;
}) {
  const sz = sizeClasses[size];
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center cursor-pointer",
        "bg-[var(--pk-badge-bg)] text-[var(--pk-badge-fg)]",
        "border border-[var(--pk-badge-border)]",
        "hover:bg-[var(--pk-badge-hover)] transition-colors",
        "backdrop-blur-sm shadow-sm",
        sz.button,
        className
      )}
      title="View provenance"
      aria-label="View provenance information"
      role="button"
      tabIndex={0}
    >
      <ShieldCheck size={sz.icon} strokeWidth={2} />
    </div>
  );
}

function ProvenanceBadgeInner({
  cid,
  bundle: bundleProp,
  children,
  position = "bottom-right",
  size = "md",
  variant = "floating",
  popoverSide = "bottom",
  onViewDetail,
  loadingSlot,
  errorSlot,
  className,
}: ProvenanceBadgeProps) {
  const { data: fetchedBundle, loading, error } = useProvenanceBundle(
    bundleProp ? null : cid,
    { enabled: !bundleProp && !!cid }
  );

  const bundle = bundleProp ?? fetchedBundle;

  if (loading && !bundle) {
    return (
      <div className={cn("relative inline-block", className)}>
        {children}
        {loadingSlot ?? (
          <div
            className={cn(
              "absolute rounded-full animate-pulse",
              "bg-[var(--pk-surface-muted)] border border-[var(--pk-surface-border)]",
              sizeClasses[size].button,
              positionClasses[position]
            )}
          />
        )}
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div className={cn("relative inline-block", className)}>
        {children}
        {errorSlot}
      </div>
    );
  }

  if (!bundle) {
    return <div className={cn("relative inline-block", className)}>{children}</div>;
  }

  const badgeButton = (
    <BadgeButton size={size} />
  );

  if (variant === "inline") {
    return (
      <div className={cn("inline-flex items-center gap-2", className)}>
        {children}
        <ProvenancePopover
          bundle={bundle}
          cid={cid}
          side={popoverSide}
          onViewDetail={onViewDetail}
        >
          {badgeButton}
        </ProvenancePopover>
      </div>
    );
  }

  return (
    <div className={cn("relative inline-block", className)}>
      {children}
      <div className={cn("absolute z-10", positionClasses[position])}>
        <ProvenancePopover
          bundle={bundle}
          cid={cid}
          side={popoverSide}
          onViewDetail={onViewDetail}
        >
          {badgeButton}
        </ProvenancePopover>
      </div>
    </div>
  );
}

export function ProvenanceBadge(props: ProvenanceBadgeProps) {
  return <ProvenanceBadgeInner {...props} />;
}
