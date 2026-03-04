"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Key } from "lucide-react";
import { KNOWN_MODELS } from "@/lib/provenance";

const schema = z.object({
  apiUrl: z.string().url("Must be a valid URL"),
  apiKey: z.string().min(1, "API key is required"),
  provider: z.enum(["openai", "anthropic", "google", "custom"]),
  model: z.string().min(1),
  enabled: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function SettingsPage() {
  const { user } = usePrivy();
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"provenancekit" | "ai">("provenancekit");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      apiUrl: "http://localhost:3001",
      provider: "openai",
      model: "gpt-4o",
      enabled: true,
    },
  });

  const selectedProvider = watch("provider");
  const filteredModels = KNOWN_MODELS.filter((m) => m.provider === selectedProvider);

  async function onSubmit(data: FormData) {
    await fetch("/api/settings/provenancekit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, userId: user?.id }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="flex gap-2 border-b pb-0">
        {(["provenancekit", "ai"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "provenancekit" ? "ProvenanceKit" : "AI Model"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {activeTab === "provenancekit" && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <Shield className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium">Connect your ProvenanceKit project</p>
                <p className="text-muted-foreground mt-0.5">
                  Get an API key from your{" "}
                  <a
                    href="http://localhost:3000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    ProvenanceKit dashboard
                  </a>
                  . Every AI response will be provenance-tracked automatically.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">API URL</label>
              <input
                type="url"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="http://localhost:3001"
                {...register("apiUrl")}
              />
              {errors.apiUrl && (
                <p className="text-xs text-destructive">{errors.apiUrl.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                  placeholder="pk_live_••••••••"
                  {...register("apiKey")}
                />
              </div>
              {errors.apiKey && (
                <p className="text-xs text-destructive">{errors.apiKey.message}</p>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded" {...register("enabled")} />
              <span className="text-sm">Enable provenance tracking</span>
            </label>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">AI Provider</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("provider")}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
                <option value="custom">Custom (OpenAI-compatible)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Model</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("model")}
              >
                {filteredModels.length > 0 ? (
                  filteredModels.map((m) => (
                    <option key={m.model} value={m.model}>
                      {m.displayName ?? m.model}
                    </option>
                  ))
                ) : (
                  <option value="custom">Custom model ID</option>
                )}
              </select>
            </div>

            {selectedProvider === "custom" && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Set <code className="font-mono text-xs">CUSTOM_AI_BASE_URL</code> and{" "}
                <code className="font-mono text-xs">CUSTOM_AI_API_KEY</code> in your{" "}
                <code className="font-mono text-xs">.env.local</code>.
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saved ? "Saved!" : isSubmitting ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
