"use client";

import {
  useRef,
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { Send, Loader2, Paperclip, Mic, MicOff, X, ImageIcon, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileProvenanceTag } from "@/components/provenance/pk-ui";
import { cn } from "@/lib/utils";
import type { FileAttachment } from "@/types";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent, attachments?: FileAttachment[]) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled,
  placeholder = "Message PK Chat… (Shift+Enter for new line)",
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
        const res = await fetch("/api/media/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        // Store original File object so FileProvenanceTag can run background provenance search
        newAttachments.push({
          url: data.url,
          mimeType: data.mimeType,
          name: data.name,
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

  const canSubmit = (value.trim() || attachments.length > 0) && !isLoading && !disabled && !isUploading && !isTranscribing;

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
    </div>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
  onViewProvenance,
}: {
  attachment: FileAttachment;
  onRemove: () => void;
  onViewProvenance: (cid: string) => void;
}) {
  const isImage = attachment.mimeType.startsWith("image/");
  return (
    <div className="flex flex-col rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs max-w-[220px]">
      {/* File name row */}
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
      {/* Provenance tag — background search fires on mount */}
      {attachment.file && (
        <FileProvenanceTag
          file={attachment.file}
          onViewDetail={onViewProvenance}
          topK={3}
        />
      )}
    </div>
  );
}
