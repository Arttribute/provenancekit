import React from "react";

interface RoleBadgeProps {
  role?: string;
  className?: string;
}

const roleStyles: Record<string, { bg: string; color: string; border: string }> = {
  human:        { bg: "rgba(59,130,246,0.1)",  color: "#2563eb", border: "rgba(59,130,246,0.25)"  },
  ai:           { bg: "rgba(124,58,237,0.1)",  color: "#7c3aed", border: "rgba(124,58,237,0.25)" },
  organization: { bg: "rgba(34,197,94,0.1)",   color: "#16a34a", border: "rgba(34,197,94,0.25)"  },
  creator:      { bg: "rgba(59,130,246,0.1)",  color: "#2563eb", border: "rgba(59,130,246,0.25)"  },
  contributor:  { bg: "rgba(124,58,237,0.1)",  color: "#7c3aed", border: "rgba(124,58,237,0.25)" },
  source:       { bg: "rgba(245,158,11,0.1)",  color: "#d97706", border: "rgba(245,158,11,0.25)" },
};

const defaultStyle = { bg: "rgba(100,116,139,0.1)", color: "#64748b", border: "rgba(100,116,139,0.2)" };

function formatRole(r: string): string {
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function RoleBadge({ role = "human", className }: RoleBadgeProps) {
  const s = roleStyles[role] ?? defaultStyle;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        lineHeight: "1.6",
      }}
    >
      {formatRole(role)}
    </span>
  );
}
