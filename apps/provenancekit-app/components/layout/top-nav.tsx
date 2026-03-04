"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, LogOut, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "./org-switcher";
import type { OrgWithRole } from "@/types";

interface TopNavProps {
  orgs: OrgWithRole[];
  currentOrgSlug?: string;
}

export function TopNav({ orgs, currentOrgSlug }: TopNavProps) {
  const { user, logout } = usePrivy();
  const router = useRouter();

  const displayName =
    user?.google?.name ??
    user?.github?.name ??
    user?.email?.address ??
    user?.wallet?.address?.slice(0, 8) ??
    "";

  const email =
    user?.email?.address ??
    user?.google?.email ??
    user?.github?.email ??
    "";

  const avatar =
    (user?.google as { profilePictureUrl?: string } | undefined)?.profilePictureUrl ??
    (user?.github as { profilePictureUrl?: string } | undefined)?.profilePictureUrl ??
    undefined;

  const initials = displayName
    ? displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : email?.slice(0, 2).toUpperCase() ?? "?";

  async function handleSignOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    await logout();
    router.replace("/login");
  }

  return (
    <header className="flex h-14 items-center border-b bg-background px-4 gap-3">
      <OrgSwitcher orgs={orgs} currentSlug={currentOrgSlug} />

      <div className="flex-1" />

      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-4 w-4" />
        <span className="sr-only">Notifications</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatar} alt={displayName} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings/profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 text-destructive focus:text-destructive"
            onSelect={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
