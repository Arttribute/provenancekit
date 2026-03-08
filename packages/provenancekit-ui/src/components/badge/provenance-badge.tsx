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

const positionStyles: Record<BadgePosition, React.CSSProperties> = {
  "top-left":     { top: 7, left: 7 },
  "top-right":    { top: 7, right: 7 },
  "bottom-left":  { bottom: 7, left: 7 },
  "bottom-right": { bottom: 7, right: 7 },
};

const sizeConfig: Record<BadgeSize, { size: number; fontSize: number }> = {
  sm: { size: 22, fontSize: 9 },
  md: { size: 28, fontSize: 11 },
  lg: { size: 38, fontSize: 15 },
};

/**
 * PrSquircle uses React.forwardRef so Radix UI Popover.Trigger (asChild) can
 * properly inject onClick and other event handlers onto the underlying <div>.
 */
const PrSquircle = React.forwardRef<
  HTMLDivElement,
  { size: BadgeSize } & React.HTMLAttributes<HTMLDivElement>
>(function PrSquircle({ size, style, onMouseEnter, onMouseLeave, ...divProps }, ref) {
  const cfg = sizeConfig[size];
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      title="View provenance"
      aria-label="View provenance information"
      {...divProps}
      style={{
        width: cfg.size,
        height: cfg.size,
        borderRadius: "28%",
        background: "var(--pk-badge-bg, #0f172a)",
        color: "var(--pk-badge-fg, #f8fafc)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
        boxShadow: "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1.5px rgba(255,255,255,0.12)",
        transition: "opacity 0.15s",
        outline: "none",
        ...style,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = "0.82";
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = "1";
        onMouseLeave?.(e);
      }}
    >
      <span
        style={{
          fontSize: cfg.fontSize,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          fontFamily: "var(--pk-badge-font-family, var(--font-red-hat-display, 'Red Hat Display', system-ui, sans-serif))",
          color: "inherit",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        Pr
      </span>
    </div>
  );
});

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
  const containerStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-block",
    lineHeight: 0,
    verticalAlign: "top",
  };

  if (loading && !bundle) {
    const cfg = sizeConfig[size];
    return (
      <div className={className} style={containerStyle}>
        {children}
        {loadingSlot ?? (
          <div
            className="animate-pulse"
            style={{
              position: "absolute",
              zIndex: 10,
              width: cfg.size,
              height: cfg.size,
              borderRadius: "28%",
              background: "rgba(0,0,0,0.18)",
              ...positionStyles[position],
            }}
          />
        )}
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div className={className} style={containerStyle}>
        {children}
        {errorSlot}
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className={className} style={containerStyle}>
        {children}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        {children}
        <ProvenancePopover bundle={bundle} cid={cid} side={popoverSide} onViewDetail={onViewDetail}>
          <PrSquircle size={size} />
        </ProvenancePopover>
      </span>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      {children}
      <div style={{ position: "absolute", zIndex: 10, ...positionStyles[position] }}>
        <ProvenancePopover bundle={bundle} cid={cid} side={popoverSide} onViewDetail={onViewDetail}>
          <PrSquircle size={size} />
        </ProvenancePopover>
      </div>
    </div>
  );
}

export function ProvenanceBadge(props: ProvenanceBadgeProps) {
  return <ProvenanceBadgeInner {...props} />;
}
