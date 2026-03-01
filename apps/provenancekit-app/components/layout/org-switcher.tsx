"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { OrgWithRole } from "@/types";

interface OrgSwitcherProps {
  orgs: OrgWithRole[];
  currentSlug?: string;
}

export function OrgSwitcher({ orgs, currentSlug }: OrgSwitcherProps) {
  const router = useRouter();
  const current = orgs.find((o) => o.slug === currentSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 gap-2 px-2 text-sm">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[120px] truncate">
            {current?.name ?? "Select org"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => router.push(`/${org.slug}`)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{org.name}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {org.role}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/orgs/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
