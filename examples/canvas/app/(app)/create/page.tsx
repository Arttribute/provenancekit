"use client";

import { Suspense, useState, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Image as ImageIcon, Type, Repeat2, Shield, DollarSign, Upload, X, Mic, Video, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaRef } from "@/types";

const MAX_FILES = 4;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "audio/mpeg", "audio/wav", "audio/ogg"];

const schema = z.object({
  type: z.enum(["text", "image", "video", "audio", "blog"]).default("text"),
  content: z.string().min(1, "Content is required").max(10000),
  tags: z.string().optional(),
  licenseType: z.string().default("CC-BY-4.0"),
  aiTraining: z.enum(["permitted", "reserved", "unspecified"]).default("unspecified"),
  isPremium: z.boolean().default(false),
  x402Price: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TYPE_OPTIONS = [
  { type: "text"  as const, icon: <Type className="h-4 w-4" />,     label: "Text" },
  { type: "image" as const, icon: <ImageIcon className="h-4 w-4" />, label: "Image" },
  { type: "video" as const, icon: <Video className="h-4 w-4" />,     label: "Video" },
  { type: "audio" as const, icon: <Mic className="h-4 w-4" />,       label: "Audio" },
  { type: "blog"  as const, icon: <FileText className="h-4 w-4" />,  label: "Blog" },
];

function CreatePageInner() {
  const { user } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const remixPostId = searchParams.get("remix");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [mediaRefs, setMediaRefs] = useState<MediaRef[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "text",
      licenseType: "CC-BY-4.0",
      aiTraining: "unspecified",
    },
  });

  const isPremium = watch("isPremium");
  const selectedType = watch("type");
  const contentValue = watch("content") || "";

  async function handleFileUpload(files: FileList) {
    if (mediaRefs.length + files.length > MAX_FILES) {
      alert(`Maximum ${MAX_FILES} files per post`);
      return;
    }
    setUploadingFiles(true);
    try {
      const uploads = Array.from(files).map(async (file) => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          throw new Error(`Unsupported file type: ${file.type}`);
        }
        const fd = new FormData();
        fd.append("file", file);
        fd.append("authorId", user!.id);
        const res = await fetch("/api/media", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        const ref: MediaRef = {
          cid: data.cid,
          url: data.url,
          mimeType: data.mimeType,
          size: data.size,
          provenanceCid: data.provenanceCid,
        };
        return ref;
      });
      const results = await Promise.all(uploads);
      setMediaRefs((prev) => [...prev, ...results]);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingFiles(false);
    }
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setSubmitError(null);
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
          mediaRefs,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to create post");
      }
      const post = await res.json();
      router.push(`/post/${post._id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setSubmitting(false);
    }
  }

  const showMediaUpload = !remixPostId && ["image", "video", "audio"].includes(selectedType);

  return (
    <div className="space-y-6 max-w-xl">
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
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map(({ type, icon, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => setValue("type", type)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                  selectedType === type
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "hover:bg-muted/50 text-muted-foreground"
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
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              {selectedType === "blog" ? "Blog post" : remixPostId ? "Your remix" : "Content"}
            </label>
            <span className="text-xs text-muted-foreground">{contentValue.length}/10000</span>
          </div>
          <textarea
            className={cn(
              "flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none",
              selectedType === "blog" ? "min-h-[300px]" : "min-h-[140px]"
            )}
            placeholder={
              remixPostId ? "Add your remix note or transformation…" :
              selectedType === "blog" ? "Write your blog post…" :
              "What are you creating today?"
            }
            {...register("content")}
          />
          {errors.content && (
            <p className="text-xs text-destructive">{errors.content.message}</p>
          )}
        </div>

        {/* Media upload */}
        {showMediaUpload && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Media files{" "}
              <span className="text-muted-foreground font-normal">
                (up to {MAX_FILES} files — images, video, audio)
              </span>
            </label>

            {/* Upload area */}
            <div
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors hover:bg-muted/30",
                uploadingFiles ? "opacity-60 pointer-events-none" : ""
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingFiles ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Uploading to IPFS…</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">Click to upload</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedType === "image" && "JPG, PNG, GIF, WebP"}
                    {selectedType === "video" && "MP4"}
                    {selectedType === "audio" && "MP3, WAV, OGG"}
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept={
                  selectedType === "image" ? "image/*" :
                  selectedType === "video" ? "video/*" :
                  "audio/*"
                }
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              />
            </div>

            {/* Uploaded media previews */}
            {mediaRefs.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {mediaRefs.map((ref, i) => {
                  const src = ref.url ?? `https://ipfs.io/ipfs/${ref.cid}`;
                  const isImage = ref.mimeType.startsWith("image/");
                  return (
                    <div key={i} className="relative aspect-video rounded-lg overflow-hidden border bg-muted">
                      {isImage ? (
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          {ref.mimeType.split("/")[0]}
                        </div>
                      )}
                      {ref.provenanceCid && (
                        <div className="absolute bottom-1 right-1 rounded-full bg-green-600/90 p-0.5">
                          <Shield className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setMediaRefs((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
            License &amp; Attribution
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Stored in the ProvenanceKit record — permanent and verifiable on IPFS.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                License
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("licenseType")}
              >
                <option value="CC-BY-4.0">CC BY 4.0 — Attribution</option>
                <option value="CC-BY-SA-4.0">CC BY-SA 4.0 — ShareAlike</option>
                <option value="CC-BY-NC-4.0">CC BY-NC 4.0 — Non-commercial</option>
                <option value="CC0-1.0">CC0 — Public Domain</option>
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
            <div className="space-y-2">
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
              </div>
              <p className="text-xs text-muted-foreground">
                After posting, deploy a 0xSplits contract to distribute revenue automatically
                to all contributors in the provenance chain.
              </p>
            </div>
          )}
        </div>

        {submitError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || uploadingFiles}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? "Publishing…" : "Publish"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreatePageInner />
    </Suspense>
  );
}
