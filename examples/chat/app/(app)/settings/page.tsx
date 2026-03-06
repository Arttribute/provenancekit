"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldCheck, ShieldOff, CheckCircle2, AlertCircle } from "lucide-react";
import { KNOWN_MODELS } from "@/lib/provenance";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { AIProvider, UserSettings } from "@/types";

const PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "custom", label: "Custom (OpenAI-compatible)" },
];

// ─── PK Status Tab ────────────────────────────────────────────────────────────

function PKStatusTab() {
  const { data: pkStatus, isLoading } = useQuery<{
    enabled: boolean;
    apiUrl: string | null;
    projectId: string | null;
  }>({
    queryKey: ["pk-status"],
    queryFn: async () => {
      const res = await fetch("/api/settings/pk-status");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-12 rounded-lg bg-muted" />
        <div className="h-4 w-48 rounded bg-muted" />
      </div>
    );
  }

  const enabled = pkStatus?.enabled ?? false;

  return (
    <div className="space-y-5">
      {/* Status card */}
      <div
        className={`flex items-start gap-3 rounded-lg border p-4 ${
          enabled
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
            : "border-border bg-muted/30"
        }`}
      >
        <div className="mt-0.5">
          {enabled ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {enabled ? "ProvenanceKit Active" : "ProvenanceKit Not Configured"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {enabled
              ? "Every AI response is automatically provenance-tracked."
              : "Add PK_API_KEY to .env.local to enable provenance tracking."}
          </p>
          {enabled && pkStatus?.apiUrl && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              {pkStatus.apiUrl}
              {pkStatus.projectId && ` · Project: ${pkStatus.projectId}`}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 text-sm space-y-3">
        <p className="font-medium text-sm">How it works</p>
        <ol className="text-muted-foreground space-y-2 text-xs list-decimal list-inside">
          <li>
            Create an account at your{" "}
            <a
              href={process.env.NEXT_PUBLIC_PK_DASHBOARD_URL ?? "http://localhost:3000"}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              ProvenanceKit dashboard
            </a>
          </li>
          <li>Create an organization and a project</li>
          <li>
            Generate an API key (<code className="font-mono">pk_live_…</code>)
          </li>
          <li>
            Add <code className="font-mono">PK_API_KEY</code> to your{" "}
            <code className="font-mono">.env.local</code>
          </li>
        </ol>
        <p className="text-xs text-muted-foreground border-t pt-2">
          ProvenanceKit is configured at the application level by the developer.
          All users of this app share the same project.
        </p>
      </div>
    </div>
  );
}

// ─── AI Model Tab ─────────────────────────────────────────────────────────────

function AIModelTab() {
  const { user } = usePrivy();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: settingsData } = useQuery<{ settings: UserSettings }>({
    queryKey: ["settings", userId],
    queryFn: async () => {
      const res = await fetch(`/api/settings?userId=${userId}`);
      return res.json();
    },
    enabled: !!userId,
  });

  const settings = settingsData?.settings;

  const [provider, setProvider] = useState<AIProvider>("openai");
  const [model, setModel] = useState("gpt-4o");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [saved, setSaved] = useState(false);

  // Sync form state when settings load
  useEffect(() => {
    if (settings) {
      setProvider(settings.defaultProvider ?? "openai");
      setModel(settings.defaultModel ?? "gpt-4o");
      setSystemPrompt(settings.systemPrompt ?? "");
    }
  }, [settings]);

  const filteredModels = KNOWN_MODELS.filter((m) => m.provider === provider);

  const { mutate: saveSettings, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          defaultProvider: provider,
          defaultModel: model,
          systemPrompt: systemPrompt || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", userId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  // When provider changes, reset model to first available option
  function handleProviderChange(newProvider: AIProvider) {
    setProvider(newProvider);
    const firstModel = KNOWN_MODELS.find((m) => m.provider === newProvider);
    if (firstModel) setModel(firstModel.model);
  }

  return (
    <div className="space-y-5">
      {/* Provider */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Default AI Provider</label>
        <Select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
        >
          {PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Default Model</label>
        <Select
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          {filteredModels.map((m) => (
            <option key={m.model} value={m.model}>
              {m.displayName} {m.contextWindow ? `(${m.contextWindow} context)` : ""}
            </option>
          ))}
          {filteredModels.length === 0 && (
            <option value="custom">Custom model ID</option>
          )}
        </Select>
        {filteredModels.find((m) => m.model === model)?.description && (
          <p className="text-xs text-muted-foreground">
            {filteredModels.find((m) => m.model === model)?.description}
          </p>
        )}
      </div>

      {provider === "custom" && (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          Set{" "}
          <code className="font-mono">CUSTOM_AI_BASE_URL</code> and{" "}
          <code className="font-mono">CUSTOM_AI_API_KEY</code> in your{" "}
          <code className="font-mono">.env.local</code> for a custom OpenAI-compatible endpoint.
        </div>
      )}

      <Separator />

      {/* System prompt override */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Custom System Prompt</label>
        <p className="text-xs text-muted-foreground">
          Override the default assistant instructions for all your conversations.
        </p>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful assistant…"
          className="min-h-[100px] font-mono text-xs"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        {saved && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Settings saved
          </p>
        )}
        <div className="ml-auto">
          <Button
            onClick={() => saveSettings()}
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"provenancekit" | "ai">("provenancekit");

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your AI model preferences and ProvenanceKit configuration.
          </p>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1 border-b">
          {(["provenancekit", "ai"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "provenancekit" ? (
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  ProvenanceKit
                </span>
              ) : (
                "AI Model"
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "provenancekit" ? <PKStatusTab /> : <AIModelTab />}
      </div>
    </div>
  );
}
