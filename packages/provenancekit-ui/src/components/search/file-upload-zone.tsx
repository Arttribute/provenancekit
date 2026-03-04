"use client";

import React, { useRef, useState, useCallback } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatBytes } from "../../lib/format";

interface FileUploadZoneProps {
  onFile: (file: File) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
}

export function FileUploadZone({
  onFile,
  accept = "image/*,video/*,audio/*,text/*",
  maxSize = 50 * 1024 * 1024, // 50MB
  disabled = false,
  className,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; size: number } | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > maxSize) {
        setError(`File too large. Max size: ${formatBytes(maxSize)}`);
        return;
      }
      setPreview({ name: file.name, size: file.size });
      onFile(file);
    },
    [onFile, maxSize]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile, disabled]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const clear = () => {
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer",
          "flex flex-col items-center justify-center gap-2 p-6 text-center",
          isDragOver
            ? "border-[var(--pk-node-resource)] bg-[var(--pk-node-resource-muted)]"
            : "border-[var(--pk-surface-border)] hover:border-[var(--pk-node-resource)]/50 hover:bg-[var(--pk-surface-muted)]",
          disabled && "pointer-events-none opacity-50"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        aria-label="Upload file for provenance search"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleChange}
          disabled={disabled}
        />
        {preview ? (
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-[var(--pk-node-resource)]" />
            <div className="text-left">
              <p className="text-sm font-medium text-[var(--pk-foreground)] truncate max-w-[200px]">
                {preview.name}
              </p>
              <p className="text-xs text-[var(--pk-muted-foreground)]">{formatBytes(preview.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clear(); }}
              className="ml-2 text-[var(--pk-muted-foreground)] hover:text-[var(--pk-foreground)]"
              aria-label="Remove file"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={24} strokeWidth={1.5} className="text-[var(--pk-muted-foreground)]" />
            <div>
              <p className="text-sm font-medium text-[var(--pk-foreground)]">
                Drop a file or click to upload
              </p>
              <p className="text-xs text-[var(--pk-muted-foreground)] mt-0.5">
                {accept.replace(/,/g, ", ")} · max {formatBytes(maxSize)}
              </p>
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
