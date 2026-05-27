"use client";

import {
  useRef,
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { Send, Loader2, Paperclip, Mic, MicOff, X, ImageIcon, FileText, ShieldCheck, ShieldOff, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useProvenanceKit } from "@/components/provenance/pk-ui";
import { ProvenanceFileDialog } from "@/components/provenance/file-search-panel";
import { cn } from "@/lib/utils";
import { defaultAttachmentGovernance } from "@/lib/governance";
import type { FileAttachment } from "@/types";
import type { Match } from "@provenancekit/sdk";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent, attachments?: FileAttachment[]) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Privy user ID — passed to the claim API so provenance is recorded under the right entity */
  userId?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled,
  placeholder = "Message PK Chat… (Shift+Enter for new line)",
  userId,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const router = useRouter();

  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((value.trim() || attachments.length > 0) && !isLoading && !disabled && !isUploading) {
        handleFormSubmit(e as unknown as FormEvent);
      }
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!value.trim() && attachments.length === 0) || isLoading || disabled || isUploading) return;
    onSubmit(e, attachments);
    setAttachments([]);
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setIsUploading(true);
    const newAttachments: FileAttachment[] = [];
    for (const file of files) {
      try {
        const form = new FormData();
        form.append("file", file);
        if (userId) form.append("userId", userId);
        const res = await fetch("/api/media/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        // Store original File object so AttachmentProvenance can run background provenance search.
        // `cid` is deliberately left unset until ProvenanceKit finds or records a resource.
        newAttachments.push({
          url: data.url,
          storageCid: data.cid,
          mimeType: data.mimeType,
          name: data.name,
          textContent: data.textContent,
          governance: defaultAttachmentGovernance("own-original"),
          file,
        });
      } catch { /* skip */ }
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        try {
          const form = new FormData();
          form.append("audio", audioBlob, "recording.webm");
          const res = await fetch("/api/media/transcribe", { method: "POST", body: form });
          if (res.ok) {
            const { text } = await res.json();
            if (text?.trim()) onChange(value ? `${value} ${text}` : text);
          }
        } catch { /* transcription failure is non-fatal */ }
        finally { setIsTranscribing(false); }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch { /* mic denied */ }
  }

  const hasUnregisteredAttachments = attachments.some((att) => att.file && !att.cid);
  const canSubmit =
    (value.trim() || attachments.length > 0) &&
    !isLoading &&
    !disabled &&
    !isUploading &&
    !isTranscribing &&
    !hasUnregisteredAttachments;

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {attachments.map((att, i) => (
            <AttachmentChip
              key={i}
              attachment={att}
              onRemove={() => removeAttachment(i)}
              onViewProvenance={(cid) => router.push(`/provenance/${cid}`)}
              onCidAssigned={(cid) =>
                setAttachments((prev) =>
                  prev.map((a, j) => j === i ? { ...a, cid } : a)
                )
              }
              onGovernanceChange={(governance) =>
                setAttachments((prev) =>
                  prev.map((a, j) => j === i ? { ...a, governance } : a)
                )
              }
              userId={userId}
            />
          ))}
        </div>
      )}
      <form
        onSubmit={handleFormSubmit}
        className="relative flex items-end gap-1 rounded-xl border border-input bg-background p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring"
      >
        <Button
          type="button" variant="ghost" size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || disabled || isUploading}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          title="Attach file or image"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>
        <input ref={fileInputRef} type="file" className="hidden"
          accept="image/*,application/pdf,text/plain,text/markdown" multiple onChange={handleFileSelect} />

        <textarea
          ref={textareaRef} value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Recording… (click mic to stop)" : isTranscribing ? "Transcribing…" : placeholder}
          disabled={disabled || isLoading || isRecording}
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[36px] max-h-[200px]"
          )}
        />

        <Button
          type="button" variant="ghost" size="icon"
          onClick={toggleRecording}
          disabled={isLoading || disabled || isTranscribing}
          className={cn("h-8 w-8 shrink-0", isRecording ? "text-red-500 hover:text-red-600 animate-pulse" : "text-muted-foreground hover:text-foreground")}
          title={isRecording ? "Stop recording" : "Record voice message"}
        >
          {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        <Button type="submit" size="icon" disabled={!canSubmit} className="h-8 w-8 shrink-0">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
      {hasUnregisteredAttachments && (
        <div className="flex items-center gap-1.5 px-1 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Finish the provenance check or claim step before sending.
        </div>
      )}
    </div>
  );
}

function AttachmentGovernanceControls({
  governance,
  onChange,
}: {
  governance: NonNullable<FileAttachment["governance"]>;
  onChange?: (governance: NonNullable<FileAttachment["governance"]>) => void;
}) {
  if (!onChange) return null;

  return (
    <div className="mt-2 rounded-lg border border-border bg-background/95 p-2 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Governance claim
        </span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
          required
        </span>
      </div>
      <select
        value={governance.status}
        onChange={(e) =>
          onChange(
            defaultAttachmentGovernance(e.target.value as "own-original" | "licensed-source" | "restricted-source")
          )
        }
        className="h-7 w-full rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="own-original">Original</option>
        <option value="licensed-source">Licensed source</option>
        <option value="restricted-source">Restricted source</option>
      </select>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <label className="space-y-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">License</span>
          <select
            value={governance.licenseType}
            onChange={(e) => onChange({ ...governance, licenseType: e.target.value })}
            className="h-7 w-full rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="CC-BY-4.0">CC BY 4.0</option>
            <option value="CC0-1.0">CC0</option>
            <option value="MIT">MIT</option>
            <option value="Proprietary">Proprietary</option>
            <option value="Custom">Custom</option>
          </select>
        </label>
        <label className="space-y-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Authorization</span>
          <select
            value={governance.authorizationStatus}
            onChange={(e) =>
              onChange({
                ...governance,
                authorizationStatus: e.target.value as "authorized" | "pending" | "unauthorized",
              })
            }
            className="h-7 w-full rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="authorized">Authorized</option>
            <option value="pending">Pending</option>
            <option value="unauthorized">Unauthorized</option>
          </select>
        </label>
        <label className="space-y-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">AI training</span>
          <select
            value={governance.aiTraining}
            onChange={(e) =>
              onChange({
                ...governance,
                aiTraining: e.target.value as "permitted" | "reserved" | "unspecified",
              })
            }
            className="h-7 w-full rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="reserved">Reserved</option>
            <option value="permitted">Permitted</option>
            <option value="unspecified">Unspecified</option>
          </select>
        </label>
        <label className="space-y-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Weight</span>
          <input
            type="number"
            min={0}
            max={10000}
            step={100}
            value={governance.contributionWeight}
            onChange={(e) =>
              onChange({
                ...governance,
                contributionWeight: Math.max(0, Math.min(10000, Number(e.target.value) || 0)),
              })
            }
            className="h-7 w-full rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      </div>
      <input
        value={governance.scope}
        onChange={(e) => onChange({ ...governance, scope: e.target.value })}
        placeholder="Authorized scope"
        className="mt-1.5 h-7 w-full rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
      />
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
        {governance.authorizationStatus === "authorized" ? (
          <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
        ) : (
          <ShieldOff className="h-2.5 w-2.5 text-amber-500" />
        )}
        <span className="truncate">
          {governance.licenseType} · AI training {governance.aiTraining}
        </span>
      </div>
    </div>
  );
}

function governanceForClaim(
  governance: FileAttachment["governance"],
  owned: boolean
): NonNullable<FileAttachment["governance"]> {
  const fallback = defaultAttachmentGovernance(owned ? "own-original" : "licensed-source");
  if (!governance) return fallback;

  if (owned) {
    return {
      ...governance,
      status: "own-original",
      authorizationStatus: "authorized",
      contributorRole: "creator",
      scope: governance.scope || fallback.scope,
      note: governance.note || "User asserted this uploaded file is an original source for the workflow.",
    };
  }

  if (governance.status === "own-original") {
    return fallback;
  }

  return {
    ...governance,
    contributorRole: governance.status === "restricted-source" ? "reference" : "source",
  };
}

function ClaimActions({
  claiming,
  onClaimOriginal,
  onRecordSource,
}: {
  claiming: boolean;
  onClaimOriginal: () => void;
  onRecordSource: () => void;
}) {
  if (claiming) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Recording provenance…
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      <button
        type="button"
        onClick={onClaimOriginal}
        className="rounded-md bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
      >
        Claim original
      </button>
      <button
        type="button"
        onClick={onRecordSource}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
      >
        Governed source
      </button>
    </div>
  );
}

/** Compact provenance indicator for an attachment chip.
 *  Runs a background search on mount; shows a small status row.
 *  On match → clickable badge that opens the ProvenanceFileDialog.
 *  On no match → inline claim prompt (Yes / No buttons). */
function AttachmentProvenance({
  file,
  onMatchFound,
  onCidAssigned,
  governance,
  onGovernanceChange,
  userId,
}: {
  file: File;
  onMatchFound?: (cid: string) => void;
  onCidAssigned?: (cid: string) => void;
  governance?: FileAttachment["governance"];
  onGovernanceChange?: (governance: NonNullable<FileAttachment["governance"]>) => void;
  userId?: string;
}) {
  const { pk } = useProvenanceKit();
  const [status, setStatus] = useState<"loading" | "found" | "not-found" | "error">("loading");
  const [topMatch, setTopMatch] = useState<Match | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimDone, setClaimDone] = useState<"claimed" | "referenced" | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    if (!pk) return;
    const isImage = file.type.startsWith("image/");
    const url = isImage ? URL.createObjectURL(file) : null;
    setPreviewUrl(url);

    pk.uploadAndMatch(file, { topK: 3 })
      .then((result) => {
        if (!result.matches?.length || result.verdict === "no-match") {
          setStatus("not-found");
        } else {
          const match = result.matches[0];
          setTopMatch(match);
          setStatus("found");
          if (match.score >= 0.95) {
            onMatchFound?.(match.cid);
          }
        }
      })
      .catch(() => {
        setSearchError(true);
        setStatus("not-found");
      });

    return () => { if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClaim(owned: boolean) {
    setClaiming(true);
    setClaimError(null);
    try {
      const claimGovernance = governanceForClaim(governance, owned);
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("owned", String(owned));
      form.append("userId", userId ?? "anonymous");
      form.append("mimeType", file.type);
      form.append("governance", JSON.stringify(claimGovernance));
      const res = await fetch("/api/pk-proxy/claim", { method: "POST", body: form });
      if (!res.ok) throw new Error("Claim failed");
      const data = await res.json();
      onCidAssigned?.(data.cid);
      setClaimDone(data.status as "claimed" | "referenced");
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Claim failed");
    }
    finally { setClaiming(false); }
  }

  if (!pk || status === "error") return null;

  if (status === "loading") {
    return (
      <div className="flex items-center gap-1 mt-1">
        <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Checking provenance…</span>
      </div>
    );
  }

  if (status === "found" && topMatch) {
    const pct = Math.round(topMatch.score * 100);
    const isHigh = pct >= 95;
    if (claimDone) {
      return (
        <div className="flex items-center gap-1 mt-1">
          <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
            {claimDone === "claimed" ? "Claimed as your work" : "Recorded as governed source"}
          </span>
        </div>
      );
    }
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={cn(
            "flex items-center gap-1 mt-1 rounded px-1 py-0.5 text-[10px] font-medium transition-colors",
            isHigh
              ? "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
          )}
        >
          <ShieldCheck className="h-2.5 w-2.5 shrink-0" />
          {pct}% match · View details →
        </button>
        {!isHigh && governance && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2 dark:border-amber-900/70 dark:bg-amber-950/20">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Low-confidence match. Register only after confirming rights.</span>
            </div>
            <AttachmentGovernanceControls governance={governance} onChange={onGovernanceChange} />
            <ClaimActions
              claiming={claiming}
              onClaimOriginal={() => handleClaim(true)}
              onRecordSource={() => handleClaim(false)}
            />
            {claimError && <p className="mt-1.5 text-[10px] text-red-600">{claimError}</p>}
          </div>
        )}
        <ProvenanceFileDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          match={topMatch}
          file={file}
          previewUrl={previewUrl}
        />
      </>
    );
  }

  if (status === "not-found") {
    if (claimDone) {
      return (
        <div className="flex items-center gap-1 mt-1">
          <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
            {claimDone === "claimed" ? "Claimed as your work" : "Recorded as external"}
          </span>
        </div>
      );
    }
    return (
      <div className="mt-2 rounded-lg border border-border bg-background/70 p-2">
        <div className="flex items-center gap-1.5">
          <ShieldOff className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] font-medium text-foreground">
            {searchError ? "Provenance lookup unavailable" : "No provenance match found"}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
          {searchError
            ? "Register this file now so the workflow can still cite it as an input resource."
            : "Register this file before sending so it appears as an input resource in the provenance explorer."}
        </p>
        {governance && (
          <AttachmentGovernanceControls governance={governance} onChange={onGovernanceChange} />
        )}
        <ClaimActions
          claiming={claiming}
          onClaimOriginal={() => handleClaim(true)}
          onRecordSource={() => handleClaim(false)}
        />
        {claimError && <p className="mt-1.5 text-[10px] text-red-600">{claimError}</p>}
      </div>
    );
  }

  return null;
}

function AttachmentChip({
  attachment,
  onRemove,
  onViewProvenance,
  onCidAssigned,
  onGovernanceChange,
  userId,
}: {
  attachment: FileAttachment;
  onRemove: () => void;
  onViewProvenance: (cid: string) => void;
  onCidAssigned?: (cid: string) => void;
  onGovernanceChange?: (governance: NonNullable<FileAttachment["governance"]>) => void;
  userId?: string;
}) {
  const isImage = attachment.mimeType.startsWith("image/");
  const governance = attachment.governance ?? defaultAttachmentGovernance("own-original");

  return (
    <div className="flex flex-col rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs w-[280px] max-w-full">
      <div className="flex items-center gap-1.5">
        {isImage
          ? <ImageIcon className="h-3 w-3 shrink-0 text-blue-500" />
          : <FileText className="h-3 w-3 shrink-0 text-orange-500" />
        }
        <span className="truncate text-muted-foreground flex-1">{attachment.name}</span>
        <button type="button" onClick={onRemove} className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground ml-1">
          <X className="h-3 w-3" />
        </button>
      </div>
      {attachment.file && (
        <AttachmentProvenance
          file={attachment.file}
          onMatchFound={onCidAssigned}
          onCidAssigned={onCidAssigned}
          governance={governance}
          onGovernanceChange={onGovernanceChange}
          userId={userId}
        />
      )}
    </div>
  );
}
