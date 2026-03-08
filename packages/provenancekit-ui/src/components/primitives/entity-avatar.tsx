import React from "react";
import { User, Bot, Building2 } from "lucide-react";

interface EntityAvatarProps {
  role?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: { px: 20, icon: 10 },
  sm: { px: 24, icon: 12 },
  md: { px: 32, icon: 14 },
  lg: { px: 40, icon: 18 },
};

const roleConfig: Record<string, { Icon: React.ElementType; color: string; bg: string; dot: string }> = {
  human:        { Icon: User,       color: "var(--pk-role-human, #3b82f6)", bg: "rgba(59,130,246,0.12)",  dot: "#3b82f6" },
  ai:           { Icon: Bot,        color: "var(--pk-role-ai, #7c3aed)",    bg: "rgba(124,58,237,0.12)", dot: "#7c3aed" },
  organization: { Icon: Building2,  color: "var(--pk-role-org, #22c55e)",   bg: "rgba(34,197,94,0.12)",  dot: "#22c55e" },
};

function initials(name?: string): string {
  if (!name) return "";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function EntityAvatar({ role = "human", name, size = "md", className }: EntityAvatarProps) {
  const sz = sizeMap[size];
  const cfg = roleConfig[role] ?? roleConfig.human;
  const { Icon } = cfg;
  const init = initials(name);

  return (
    <div
      className={className}
      style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
    >
      <div
        style={{
          width: sz.px,
          height: sz.px,
          borderRadius: "50%",
          background: cfg.bg,
          border: `1.5px solid ${cfg.color}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: cfg.color,
        }}
      >
        {init ? (
          <span style={{ fontSize: sz.icon - 2, fontWeight: 700, lineHeight: 1 }}>{init}</span>
        ) : (
          <Icon size={sz.icon} strokeWidth={1.8} />
        )}
      </div>
      {/* Role dot */}
      <span
        style={{
          position: "absolute",
          bottom: -1,
          right: -1,
          width: sz.icon * 0.55,
          height: sz.icon * 0.55,
          borderRadius: "50%",
          background: cfg.dot,
          border: "2px solid var(--pk-surface, #fff)",
          display: "block",
        }}
      />
    </div>
  );
}
