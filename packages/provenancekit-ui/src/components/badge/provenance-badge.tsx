"use client";

import React from "react";
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

// Squircle "Pr" badge — the ProvenanceKit mark
// border-radius 28% gives a squircle (rounded square) shape, similar to C2PA "cr" badge
const sizeConfig: Record<BadgeSize, { wh: string; text: string }> = {
  sm: { wh: "w-[18px] h-[18px]", text: "text-[8px]" },
  md: { wh: "w-[22px] h-[22px]", text: "text-[10px]" },
  lg: { wh: "w-[28px] h-[28px]", text: "text-[12px]" },
};

function PrSquircle({
  size,
  className,
}: {
  size: BadgeSize;
  className?: string;
}) {
  const cfg = sizeConfig[size];
  return (
    <div
      className={cn(
        "flex items-center justify-center cursor-pointer select-none shrink-0",
        "bg-[var(--pk-badge-bg)] text-[var(--pk-badge-fg)]",
        "border border-[var(--pk-badge-border)]",
        "hover:opacity-90 active:scale-95 transition-all duration-100",
        "shadow-sm",
        cfg.wh,
        className
      )}
      style={{ borderRadius: "28%" }}
      title="View provenance"
      aria-label="View provenance information"
      role="button"
      tabIndex={0}
    >
      <span
        className={cn("font-bold tracking-tight leading-none select-none", cfg.text)}
        style={{ fontFamily: "var(--pk-badge-font-family, 'Red Hat Display', system-ui, sans-serif)" }}
      >
        Pr
      </span>
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
              "absolute animate-pulse bg-[var(--pk-surface-muted)] border border-[var(--pk-surface-border)]",
              sizeConfig[size].wh,
              positionClasses[position]
            )}
            style={{ borderRadius: "28%" }}
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

  const badge = <PrSquircle size={size} />;

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
          {badge}
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
          {badge}
        </ProvenancePopover>
      </div>
    </div>
  );
}

export function ProvenanceBadge(props: ProvenanceBadgeProps) {
  return <ProvenanceBadgeInner {...props} />;
}
