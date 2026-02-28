"use client";

import React, { useState } from "react";
import { cn } from "../../lib/utils";
import { formatDate, formatDateAbsolute } from "../../lib/format";

interface TimestampProps {
  iso: string | undefined | null;
  className?: string;
}

export function Timestamp({ iso, className }: TimestampProps) {
  const [showAbsolute, setShowAbsolute] = useState(false);

  if (!iso) return null;

  return (
    <time
      dateTime={iso}
      className={cn("text-xs text-[var(--pk-muted-foreground)] cursor-default", className)}
      title={formatDateAbsolute(iso)}
      onMouseEnter={() => setShowAbsolute(true)}
      onMouseLeave={() => setShowAbsolute(false)}
    >
      {showAbsolute ? formatDateAbsolute(iso) : formatDate(iso)}
    </time>
  );
}
