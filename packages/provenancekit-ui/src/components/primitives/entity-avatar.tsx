import React from "react";
import { User, Bot, Building2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { EntityRole } from "@provenancekit/eaa-types";

interface EntityAvatarProps {
  role: EntityRole | string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: { container: "size-5", icon: 10, dot: "size-1.5" },
  sm: { container: "size-6", icon: 12, dot: "size-2" },
  md: { container: "size-8", icon: 14, dot: "size-2.5" },
  lg: { container: "size-10", icon: 18, dot: "size-3" },
};

const roleConfig = {
  human: {
    Icon: User,
    bgClass: "bg-[var(--pk-role-human)]/15",
    fgClass: "text-[var(--pk-role-human)]",
    dotClass: "bg-[var(--pk-role-human)]",
  },
  ai: {
    Icon: Bot,
    bgClass: "bg-[var(--pk-role-ai)]/15",
    fgClass: "text-[var(--pk-role-ai)]",
    dotClass: "bg-[var(--pk-role-ai)]",
  },
  organization: {
    Icon: Building2,
    bgClass: "bg-[var(--pk-role-org)]/15",
    fgClass: "text-[var(--pk-role-org)]",
    dotClass: "bg-[var(--pk-role-org)]",
  },
} as const;

function getRoleConfig(role: string) {
  if (role === "human") return roleConfig.human;
  if (role === "ai") return roleConfig.ai;
  if (role === "organization") return roleConfig.organization;
  // Default for unknown/extension roles
  return roleConfig.human;
}

export function EntityAvatar({ role, size = "md", className }: EntityAvatarProps) {
  const sz = sizeMap[size];
  const cfg = getRoleConfig(role);
  const { Icon } = cfg;

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center",
          sz.container,
          cfg.bgClass,
          cfg.fgClass
        )}
      >
        <Icon size={sz.icon} strokeWidth={1.8} />
      </div>
      {/* Role indicator dot */}
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[var(--pk-surface)]",
          sz.dot,
          cfg.dotClass
        )}
      />
    </div>
  );
}
