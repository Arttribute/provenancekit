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
  cid?: string;
  bundle?: ProvenanceBundle;
  children?: React.ReactNode;
  position?: BadgePosition;
  size?: BadgeSize;
  variant?: BadgeVariant;
  popoverSide?: "top" | "bottom" | "left" | "right";
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

// Larger, more prominent sizing — md is a clearly visible 30px mark
const sizeConfig: Record<BadgeSize, { size: number; fontSize: number; fontWeight: number }> = {
  sm: { size: 24, fontSize: 9, fontWeight: 800 },
  md: { size: 32, fontSize: 12, fontWeight: 800 },
  lg: { size: 44, fontSize: 16, fontWeight: 800 },
};

function PrSquircle({ size }: { size: BadgeSize }) {
  const cfg = sizeConfig[size];
  return (
    <div
      style={{
        width: cfg.size,
        height: cfg.size,
        borderRadius: "28%",
        background: "var(--pk-badge-bg, oklch(0.12 0.04 250))",
        color: "var(--pk-badge-fg, #fff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
        boxShadow: "0 2px 8px rgba(0,0,0,0.25), 0 0 0 1.5px rgba(255,255,255,0.15)",
        transition: "opacity 0.15s, transform 0.1s",
      }}
      title="View provenance"
      aria-label="View provenance information"
      role="button"
      tabIndex={0}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
    >
      <span
        style={{
          fontSize: cfg.fontSize,
          fontWeight: cfg.fontWeight,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          fontFamily: "var(--pk-badge-font-family, 'Red Hat Display', system-ui, sans-serif)",
          color: "inherit",
        }}
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
    const cfg = sizeConfig[size];
    return (
      <div className={cn("relative inline-block", className)}>
        {children}
        {loadingSlot ?? (
          <div
            className={cn("absolute animate-pulse", positionClasses[position])}
            style={{
              width: cfg.size,
              height: cfg.size,
              borderRadius: "28%",
              background: "rgba(0,0,0,0.15)",
            }}
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
        <ProvenancePopover bundle={bundle} cid={cid} side={popoverSide} onViewDetail={onViewDetail}>
          {badge}
        </ProvenancePopover>
      </div>
    );
  }

  return (
    <div className={cn("relative inline-block", className)}>
      {children}
      <div className={cn("absolute z-10", positionClasses[position])}>
        <ProvenancePopover bundle={bundle} cid={cid} side={popoverSide} onViewDetail={onViewDetail}>
          {badge}
        </ProvenancePopover>
      </div>
    </div>
  );
}

export function ProvenanceBadge(props: ProvenanceBadgeProps) {
  return <ProvenanceBadgeInner {...props} />;
}
