"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Image, Type, Repeat2, Shield, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostType } from "@/types";

const schema = z.object({
  type: z.enum(["text", "image", "video", "audio", "blog"]).default("text"),
  content: z.string().min(1, "Content is required").max(5000),
  tags: z.string().optional(),
  licenseType: z.string().default("CC-BY-4.0"),
  aiTraining: z.enum(["permitted", "reserved", "unspecified"]).default("unspecified"),
  isPremium: z.boolean().default(false),
  x402Price: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TYPE_OPTIONS: Array<{ type: PostType; icon: React.ReactNode; label: string }> = [
  { type: "text", icon: <Type className="h-4 w-4" />, label: "Text" },
  { type: "image", icon: <Image className="h-4 w-4" />, label: "Image" },
];

export default function CreatePage() {
  const { user } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const remixPostId = searchParams.get("remix");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "text", licenseType: "CC-BY-4.0", aiTraining: "unspecified" },
  });

  const isPremium = watch("isPremium");
  const selectedType = watch("type");

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          tags: data.tags
            ? data.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : [],
          authorId: user?.id,
          originalPostId: remixPostId,
          type: remixPostId ? "remix" : data.type,
        }),
      });
      if (!res.ok) throw new Error("Failed to create post");
      const post = await res.json();
      router.push(`/post/${post._id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {remixPostId ? "Create Remix" : "Create Post"}
        </h1>
        {remixPostId && (
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Repeat2 className="h-4 w-4" />
            Remixing post {remixPostId.slice(0, 8)}… — attribution is tracked automatically
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Type selector */}
        {!remixPostId && (
          <div className="flex gap-2">
            {TYPE_OPTIONS.map(({ type, icon, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => setValue("type", type)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                  selectedType === type
                    ? "border-primary bg-primary/5 text-primary"
                    : "hover:bg-muted/50"
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Content</label>
          <textarea
            className="flex min-h-[140px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            placeholder={remixPostId ? "Add your remix note or transformation…" : "What are you creating?"}
            {...register("content")}
          />
          {errors.content && (
            <p className="text-xs text-destructive">{errors.content.message}</p>
          )}
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Tags{" "}
            <span className="text-muted-foreground font-normal">(comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="ai, art, music"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register("tags")}
          />
        </div>

        {/* License + AI training */}
        <div className="rounded-xl border p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4 text-muted-foreground" />
            License & Attribution
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                License
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("licenseType")}
              >
                <option value="CC-BY-4.0">CC BY 4.0</option>
                <option value="CC-BY-SA-4.0">CC BY-SA 4.0</option>
                <option value="CC-BY-NC-4.0">CC BY-NC 4.0</option>
                <option value="CC0-1.0">CC0 (Public Domain)</option>
                <option value="all-rights-reserved">All Rights Reserved</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                AI Training (DSM Art. 4)
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("aiTraining")}
              >
                <option value="unspecified">Unspecified</option>
                <option value="permitted">Permitted</option>
                <option value="reserved">Reserved (opt-out)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Monetization */}
        <div className="rounded-xl border p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            Monetization
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 rounded" {...register("isPremium")} />
            <span className="text-sm">Premium content (require payment to view)</span>
          </label>
          {isPremium && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Price (USDC)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="1.00"
                className="flex h-9 max-w-[120px] rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("x402Price")}
              />
              <p className="text-xs text-muted-foreground">
                Revenue splits to all contributors via 0xSplits are deployed automatically.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Publishing…" : "Publish"}
          </button>
        </div>
      </form>
    </div>
  );
}
