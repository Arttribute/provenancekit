// components/chat/chat-input.tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, Mic, MicOff } from "lucide-react";
import { FilePreview } from "./file-preview";
import { AudioRecorder } from "./audio-recorder";
import { AttachmentModal } from "./attachment-modal";
import { InspectedAttachment } from "@/lib/attachments";
import { ProvenanceGraphDialog } from "@/components/provenance/provenance-graph-dialog";

function uuid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export interface ChatInputProps {
  onSendMessage: (message: string, attachments: InspectedAttachment[]) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<InspectedAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ---------- helper: start pending items ---------- */
  const addPending = useCallback((files: File[]) => {
    const pending: InspectedAttachment[] = files.map((f) => ({
      tempId: uuid(),
      file: f,
      status: "pending",
      cid: null,
      score: null,
      type: "unknown",
      mime: f.type,
      size: f.size,
      graph: null,
    }));
    setAttachments((prev) => [...prev, ...pending]);
    return pending.map((p) => p.tempId);
  }, []);

  /* ---------- inspect and merge back ---------- */
  const runInspection = useCallback(
    async (files: File[], tempIds: string[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("topK", "1");
      fd.append("minScore", "0.95");

      let data;
      try {
        const res = await fetch("/api/attachments/inspect", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error(await res.text());
        data = await res.json();
      } catch (e) {
        console.error("inspect failed", e);
        // mark as new if it fails
        setAttachments((prev) =>
          prev.map((a) =>
            tempIds.includes(a.tempId) ? { ...a, status: "new" as const } : a
          )
        );
        return;
      }

      // patch each result back using tempIds order
      setAttachments((prev) =>
        prev.map((a) => {
          const idx = tempIds.indexOf(a.tempId);
          if (idx === -1) return a;
          const r = data.results[idx];
          return {
            ...a,
            status: r.status,
            cid: r.cid,
            score: r.score,
            type: r.type,
            graph: r.graph,
          };
        })
      );
    },
    []
  );

  const inspectNewFiles = useCallback(
    async (files: File[]) => {
      const ids = addPending(files); // optimistic add
      await runInspection(files, ids);
    },
    [addPending, runInspection]
  );

  /* ---------------- Drag & Drop -------------------- */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (!files.length) return;
      inspectNewFiles(files);
    },
    [inspectNewFiles]
  );

  /* --------------- File picker --------------------- */
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      inspectNewFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [inspectNewFiles]
  );

  /* --------------- Remove -------------------------- */
  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* --------------- Send ---------------------------- */
  const handleSend = useCallback(() => {
    if (message.trim() || attachments.length > 0) {
      onSendMessage(message, attachments); // ◄──── pass full objects
      setMessage("");
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = "48px";
    }
  }, [message, attachments, onSendMessage]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  /* --------------- Textarea resize ----------------- */
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value);
      const textarea = e.target;
      textarea.style.height = "48px";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    },
    []
  );

  /* --------------- Audio --------------------------- */
  const handleAudioRecorded = useCallback(
    async (blob: Blob) => {
      const f = new File([blob], `recording-${Date.now()}.wav`, {
        type: "audio/wav",
      });
      setIsRecording(false);
      inspectNewFiles([f]);
    },
    [inspectNewFiles]
  );

  return (
    <>
      <div
        className={`relative bg-gray-100 rounded-3xl transition-all duration-200 min-h-[80px] ${
          isDragOver ? "bg-blue-50 ring-2 ring-blue-500" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-90 rounded-3xl z-10">
            <div className="text-blue-600 text-center">
              <Paperclip className="w-6 h-6 mx-auto mb-2" />
              <p className="font-medium">Drop files here to attach</p>
            </div>
          </div>
        )}

        <div className="flex flex-col p-4">
          {/* attachments row */}
          {attachments.length > 0 && (
            <div className="mb-4 -mx-1">
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {attachments.map((att, index) => (
                  <div key={att.tempId} className="flex flex-col">
                    <FilePreview
                      file={att.file}
                      onRemove={() => removeAttachment(index)}
                      onExpand={() => setSelectedIdx(index)}
                      matched={att.status === "match"}
                      pending={att.status === "pending"}
                    />
                    {att.status === "match" && att.cid && (
                      <div className="mt-1 flex justify-center">
                        <ProvenanceGraphDialog
                          cid={att.cid}
                          trigger={
                            <Button
                              variant="ghost"
                              className="text-xs h-6 px-2"
                            >
                              Provenance
                            </Button>
                          }
                          title={`Provenance: ${att.cid.slice(0, 12)}…`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* audio row */}
          {isRecording && (
            <div className="mb-4 p-3 bg-blue-50 rounded-2xl border border-blue-200">
              <AudioRecorder
                onRecordingComplete={handleAudioRecorded}
                onCancel={() => setIsRecording(false)}
              />
            </div>
          )}

          {/* input row */}
          <div className="flex items-end gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 h-8 w-8 p-0 hover:bg-gray-200 rounded-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
              placeholder="Ask anything"
              className="flex-1 bg-transparent border-0 outline-none resize-none text-gray-900 placeholder-gray-500 leading-6"
              style={{ minHeight: "48px" }}
              rows={3}
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`shrink-0 h-8 w-8 p-0 rounded-full hover:bg-gray-200 ${
                isRecording ? "text-red-600 bg-red-50" : ""
              }`}
              onClick={() => setIsRecording(!isRecording)}
            >
              {isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>

            <Button
              onClick={handleSend}
              disabled={!message.trim() && attachments.length === 0}
              size="sm"
              className="shrink-0 h-8 w-8 p-0 rounded-full bg-gray-800 hover:bg-gray-700 disabled:bg-gray-300"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* hidden input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept="*/*"
      />

      {selectedIdx != null && (
        <AttachmentModal
          attachment={attachments[selectedIdx]}
          onClose={() => setSelectedIdx(null)}
          onRemove={() => {
            removeAttachment(selectedIdx);
            setSelectedIdx(null);
          }}
        />
      )}
    </>
  );
}
