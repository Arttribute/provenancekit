"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatCid } from "../../lib/format";

interface CidDisplayProps {
  cid: string | undefined | null;
  prefixLen?: number;
  suffixLen?: number;
  showCopy?: boolean;
  className?: string;
}

export function CidDisplay({
  cid,
  prefixLen = 8,
  suffixLen = 6,
  showCopy = true,
  className,
}: CidDisplayProps) {
  const [copied, setCopied] = useState(false);

  if (!cid) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-1 group", className)}>
      <span
        className="font-mono text-xs text-[var(--pk-muted-foreground)] cursor-default"
        title={cid}
      >
        {formatCid(cid, prefixLen, suffixLen)}
      </span>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--pk-muted-foreground)] hover:text-[var(--pk-foreground)]"
          title="Copy CID"
          aria-label="Copy CID to clipboard"
        >
          {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} strokeWidth={2} />}
        </button>
      )}
    </span>
  );
}
