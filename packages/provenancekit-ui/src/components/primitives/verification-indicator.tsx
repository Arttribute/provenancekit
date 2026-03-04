import React from "react";
import { ShieldCheck, ShieldAlert, ShieldOff, Shield } from "lucide-react";
import { cn } from "../../lib/utils";

type VerificationStatus = "verified" | "partial" | "unverified" | "skipped" | "failed";

interface VerificationIndicatorProps {
  status: VerificationStatus;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const statusConfig: Record<
  VerificationStatus,
  { Icon: React.ElementType; label: string; className: string }
> = {
  verified: {
    Icon: ShieldCheck,
    label: "Verified",
    className: "text-[var(--pk-verified)]",
  },
  partial: {
    Icon: ShieldAlert,
    label: "Partially verified",
    className: "text-[var(--pk-partial)]",
  },
  unverified: {
    Icon: ShieldOff,
    label: "Unverified",
    className: "text-[var(--pk-unverified)]",
  },
  skipped: {
    Icon: Shield,
    label: "Skipped",
    className: "text-[var(--pk-unverified)]",
  },
  failed: {
    Icon: ShieldOff,
    label: "Failed",
    className: "text-[var(--pk-failed)]",
  },
};

export function VerificationIndicator({
  status,
  showLabel = false,
  size = "md",
  className,
}: VerificationIndicatorProps) {
  const cfg = statusConfig[status] ?? statusConfig.unverified;
  const { Icon } = cfg;
  const iconSize = size === "sm" ? 12 : 16;

  return (
    <span
      className={cn("inline-flex items-center gap-1", cfg.className, className)}
      title={cfg.label}
    >
      <Icon size={iconSize} strokeWidth={2} />
      {showLabel && (
        <span className="text-xs font-medium">{cfg.label}</span>
      )}
    </span>
  );
}
