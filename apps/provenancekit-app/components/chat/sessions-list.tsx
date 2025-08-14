"use client";

import Link from "next/link";

type SessionItem = {
  sessionId: string;
  title?: string | null;
};

interface SessionsListProps {
  /** Array of sessions (can be empty).
   *  The caller should ALWAYS pass an array –
   *  but we still default‑protect here. */
  sessions?: SessionItem[];
}

export default function SessionsList({ sessions = [] }: SessionsListProps) {
  return (
    <>
      {sessions.length === 0 && (
        <p className="text-muted-foreground text-xs">No sessions yet.</p>
      )}

      {sessions.map((s) => (
        <Link
          href={`/chat/${s.sessionId}`}
          key={s.sessionId}
          className="block px-2 py-1 rounded hover:bg-muted"
        >
          <p className="truncate text-sm">
            {s.title?.trim() || "Untitled session"}
          </p>
        </Link>
      ))}
    </>
  );
}
