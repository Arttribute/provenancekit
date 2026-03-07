"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Shield, Wallet, User, ShieldCheck, CheckCircle2, Upload } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import type { PublicUser } from "@/types";

export default function SettingsPage() {
  const { user: privyUser, logout } = usePrivy();
  const qc = useQueryClient();

  const { data: profile } = useQuery<PublicUser>({
    queryKey: ["profile", privyUser?.id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${privyUser?.id}`);
      return res.json();
    },
    enabled: !!privyUser?.id,
  });

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "");
      setDisplayName(profile.displayName ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  const profileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${privyUser?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), displayName: displayName.trim(), bio: bio.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", privyUser?.id] });
      setSaved("profile");
      setError(null);
      setTimeout(() => setSaved(null), 2500);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-5 max-w-xl">
      <div className="space-y-0.5">
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and account</p>
      </div>

      {/* ── Profile ──────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Profile</h2>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Username <span className="font-normal">(letters, numbers, _)</span>
            </label>
            <div className="flex items-center rounded-md border bg-background overflow-hidden">
              <span className="px-3 text-sm text-muted-foreground bg-muted border-r">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())}
                placeholder="your_username"
                className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the world about yourself…"
              rows={3}
              maxLength={200}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
          </div>
        </div>

        <button
          onClick={() => profileMutation.mutate()}
          disabled={profileMutation.isPending}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saved === "profile" ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Saved
            </>
          ) : profileMutation.isPending ? "Saving…" : "Save profile"}
        </button>
      </section>

      {/* ── Wallet ───────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Wallet</h2>
        </div>
        <div className="rounded-md bg-muted px-3 py-2.5">
          <p className="text-xs text-muted-foreground mb-0.5">Connected wallet</p>
          <p className="font-mono text-sm">
            {profile?.wallet ? truncateAddress(profile.wallet) : "No wallet connected"}
          </p>
          {profile?.wallet && (
            <p className="font-mono text-xs text-muted-foreground mt-0.5">{profile.wallet}</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your wallet receives on-chain revenue distributions from monetized content.
          Connect a wallet in Privy to enable splits payouts.
        </p>
      </section>

      {/* ── ProvenanceKit Status ─────────────────────────── */}
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">ProvenanceKit</h2>
        </div>

        <div className="rounded-lg border bg-green-50 dark:bg-green-900/20 p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Platform provenance is active
            </p>
          </div>
          <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">
            Canvas uses ProvenanceKit to record the authorship, license, and creation 
            history of every post on-chain. This is handled automatically at the platform 
            level — you don&apos;t need to configure anything.
          </p>
        </div>

        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
            <span>Every post you publish is content-addressed on IPFS</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
            <span>Authorship is verified and linked to your identity</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
            <span>Remix chains track all contributors automatically</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
            <span>Revenue distribution follows the provenance graph</span>
          </div>
        </div>

        {profile?.provenanceEntityId && (
          <div className="rounded-md bg-muted px-3 py-2 space-y-0.5">
            <p className="text-xs text-muted-foreground font-medium">Your Entity ID</p>
            <p className="font-mono text-xs">{profile.provenanceEntityId}</p>
            <p className="text-xs text-muted-foreground">
              Used in the provenance graph to identify your contributions.
            </p>
          </div>
        )}

        <a
          href="https://docs.provenancekit.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Learn how ProvenanceKit works →
        </a>
      </section>

      {/* ── Danger zone ─────────────────────────────────── */}
      <section className="rounded-xl border border-destructive/20 bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-destructive">Account</h2>
        <button
          onClick={logout}
          className="rounded-md border border-destructive/30 px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
