import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { formatRole } from "../../lib/format";

const roleBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      role: {
        creator:
          "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20",
        contributor:
          "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-400/10 dark:text-violet-400 dark:ring-violet-400/20",
        source:
          "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20",
        human:
          "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20",
        ai: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-400/10 dark:text-violet-400 dark:ring-violet-400/20",
        organization:
          "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-400/20",
        default:
          "bg-gray-50 text-gray-600 ring-gray-500/20 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20",
      },
    },
    defaultVariants: { role: "default" },
  }
);

type KnownRole = "creator" | "contributor" | "source" | "human" | "ai" | "organization";

function resolveVariant(role: string): KnownRole | "default" {
  const knownRoles: KnownRole[] = ["creator", "contributor", "source", "human", "ai", "organization"];
  return (knownRoles as string[]).includes(role) ? (role as KnownRole) : "default";
}

interface RoleBadgeProps {
  role: string;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span className={cn(roleBadgeVariants({ role: resolveVariant(role) }), className)}>
      {formatRole(role)}
    </span>
  );
}
