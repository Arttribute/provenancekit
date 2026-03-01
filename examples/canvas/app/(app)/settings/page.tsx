"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CanvasUser } from "@/types";

export default function SettingsPage() {
  const { user } = usePrivy();
  const qc = useQueryClient();

  const { data: profile } = useQuery<CanvasUser>({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [pkApiKey, setPkApiKey] = useState("");
  const [pkApiUrl, setPkApiUrl] = useState("https://api.provenancekit.org");
  const [saved, setSaved] = useState<string | null>(null);

  const profileMutation = useMutation({
    mutationFn: async (data: { username: string; bio: string }) => {
      const res = await fetch(`/api/users/${user?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      setSaved("profile");
      setTimeout(() => setSaved(null), 2000);
    },
  });

  const pkMutation = useMutation({
    mutationFn: async (data: { pkApiKey: string; pkApiUrl: string }) => {
      const res = await fetch(`/api/users/${user?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      setSaved("pk");
      setTimeout(() => setSaved(null), 2000);
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your profile and provenance tracking
        </p>
      </div>

      {/* Profile */}
      <section className="rounded-xl border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold">Profile</h2>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Username</label>
            <input
              type="text"
              value={username || profile?.username || ""}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Bio</label>
            <textarea
              value={bio || profile?.bio || ""}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the world about yourself..."
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <button
          onClick={() =>
            profileMutation.mutate({
              username: username || profile?.username || "",
              bio: bio || profile?.bio || "",
            })
          }
          disabled={profileMutation.isPending}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saved === "profile" ? "Saved!" : profileMutation.isPending ? "Saving…" : "Save profile"}
        </button>
      </section>

      {/* Wallet */}
      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Wallet</h2>
        <div className="rounded-md bg-muted px-3 py-2">
          <p className="text-xs text-muted-foreground">Connected wallet</p>
          <p className="font-mono text-xs mt-0.5">{profile?.wallet ?? "No wallet connected"}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Your wallet receives on-chain revenue distributions from your monetized content.
        </p>
      </section>

      {/* ProvenanceKit */}
      <section className="rounded-xl border bg-card p-4 space-y-4">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold">ProvenanceKit</h2>
          <p className="text-xs text-muted-foreground">
            Connect your ProvenanceKit project to enable on-chain provenance tracking.
            Get an API key at{" "}
            <a
              href="https://app.provenancekit.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              app.provenancekit.org
            </a>
            .
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">API Key</label>
            <input
              type="password"
              value={pkApiKey || (profile?.provenancekitApiKey ? "••••••••" : "")}
              onChange={(e) => setPkApiKey(e.target.value)}
              placeholder="pk_live_..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">API URL</label>
            <input
              type="text"
              value={pkApiUrl || profile?.provenancekitApiKey ? pkApiUrl : ""}
              onChange={(e) => setPkApiUrl(e.target.value)}
              placeholder="https://api.provenancekit.org"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              pkMutation.mutate({
                pkApiKey,
                pkApiUrl,
              })
            }
            disabled={pkMutation.isPending || !pkApiKey}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saved === "pk" ? "Saved!" : pkMutation.isPending ? "Saving…" : "Save API key"}
          </button>
          {profile?.provenancekitApiKey && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              ✓ Connected
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
