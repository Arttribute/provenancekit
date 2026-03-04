"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Plus, DollarSign, Settings, User, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/feed",    icon: Home,       label: "Feed" },
  { href: "/explore", icon: Compass,    label: "Explore" },
  { href: "/create",  icon: Plus,       label: "Create" },
  { href: "/earnings",icon: DollarSign, label: "Earnings" },
  { href: "/settings",icon: Settings,   label: "Settings" },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();
  const upserted = useRef(false);

  useEffect(() => {
    if (ready && !authenticated) router.push("/");
  }, [ready, authenticated, router]);

  // Register / upsert user in DB on first login (runs once per session)
  useEffect(() => {
    if (!ready || !authenticated || !user || upserted.current) return;
    upserted.current = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = user.linkedAccounts as any[];
    const wallet =
      user.wallet?.address ??
      accounts?.find((a) => a.type === "wallet")?.address;

    const displayName =
      user.google?.name ??
      user.github?.name ??
      user.email?.address?.split("@")[0] ??
      `user_${user.id.slice(-6)}`;

    const username =
      user.email?.address?.split("@")[0]?.replace(/[^a-z0-9_]/gi, "").toLowerCase() ??
      `user${user.id.slice(-6)}`;

    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        privyDid: user.id,
        email: user.email?.address,
        wallet,
        displayName,
        username,
      }),
    }).catch(() => {});
  }, [ready, authenticated, user]);

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background/95 backdrop-blur-sm px-4 gap-4">
        {/* Logo */}
        <Link href="/feed" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            C
          </span>
          <span className="hidden sm:inline text-primary">Canvas</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 ml-auto">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}

          {/* Profile link */}
          <Link
            href={`/profile/${user?.id}`}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ml-1",
              pathname.startsWith("/profile")
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        </nav>

        {/* PK status indicator */}
        <div
          className="flex items-center gap-1 rounded-full border bg-green-50 dark:bg-green-900/20 px-2 py-0.5 text-xs text-green-700 dark:text-green-400 shrink-0 ml-1 hidden md:flex"
          title="ProvenanceKit is active — all posts are provenance-tracked"
        >
          <ShieldCheck className="h-3 w-3" />
          <span>PK Active</span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
