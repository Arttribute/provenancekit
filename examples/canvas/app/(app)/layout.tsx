"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Plus, DollarSign, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/feed", icon: Home, label: "Feed" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/create", icon: Plus, label: "Create" },
  { href: "/earnings", icon: DollarSign, label: "Earnings" },
  { href: "/settings", icon: Settings, label: "Settings" },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !authenticated) router.push("/");
  }, [ready, authenticated, router]);

  // Register / upsert user in DB on login
  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    const wallet = user.wallet?.address ?? user.linkedAccounts?.find((a: { type: string }) => a.type === "wallet")?.address;
    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        privyDid: user.id,
        email: user.email?.address,
        wallet,
      }),
    }).catch(() => {});
  }, [ready, authenticated, user]);

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/80 backdrop-blur-sm px-4">
        <Link href="/feed" className="flex items-center gap-2 font-bold text-lg mr-auto">
          <span className="text-primary">Canvas</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
