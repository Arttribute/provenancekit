"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { TrackerSessionHeader } from "./tracker-session-header";
import { TrackerActionItem } from "./tracker-action-item";
import { useSessionProvenance } from "../../hooks/use-session-provenance";
import type { SessionProvenance } from "@provenancekit/sdk";
import type { Action } from "@provenancekit/eaa-types";

export interface ProvenanceTrackerProps {
  /** Session ID — auto-polls pk.sessionProvenance() */
  sessionId?: string;
  pollInterval?: number;
  /** Headless mode — pass session directly */
  session?: SessionProvenance;
  maxActions?: number;
  showEntities?: boolean;
  showResources?: boolean;
  onNewAction?: (action: Action) => void;
  className?: string;
}

export function ProvenanceTracker({
  sessionId,
  pollInterval = 3000,
  session: sessionProp,
  maxActions = 20,
  onNewAction,
  className,
}: ProvenanceTrackerProps) {
  const headless = !!sessionProp;

  const { data: fetchedSession, loading, error } = useSessionProvenance(
    headless ? null : sessionId,
    { enabled: !headless && !!sessionId, pollInterval }
  );

  const session = sessionProp ?? fetchedSession;

  // Notify on new actions
  const prevActionCount = useRef(0);
  useEffect(() => {
    if (!session) return;
    const newCount = session.actions.length;
    if (newCount > prevActionCount.current && onNewAction) {
      const newActions = session.actions.slice(prevActionCount.current);
      newActions.forEach(onNewAction);
    }
    prevActionCount.current = newCount;
  }, [session, onNewAction]);

  if (!session && loading) {
    return (
      <div className={cn("animate-pulse space-y-2", className)}>
        <div className="h-10 rounded-lg bg-[var(--pk-surface-muted)]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-[var(--pk-surface-muted)]" />
        ))}
      </div>
    );
  }

  if (!session && error) {
    return (
      <div className={cn("rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600", className)}>
        {error.message}
      </div>
    );
  }

  if (!session) {
    return (
      <div className={cn("rounded-lg border border-[var(--pk-surface-border)] p-6 text-center", className)}>
        <p className="text-sm text-[var(--pk-muted-foreground)]">No session data</p>
      </div>
    );
  }

  // Show latest actions first, capped at maxActions
  const actions = [...session.actions].reverse().slice(0, maxActions);

  return (
    <div className={cn("space-y-3", className)}>
      <TrackerSessionHeader session={session} />

      {actions.length === 0 ? (
        <div className="rounded-lg border border-[var(--pk-surface-border)] p-6 text-center">
          <p className="text-sm text-[var(--pk-muted-foreground)]">
            No actions recorded yet. Waiting…
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--pk-surface-border)] bg-[var(--pk-surface)] px-4 pt-4 pb-0">
          {actions.map((action, i) => (
            <TrackerActionItem
              key={action.id ?? i}
              action={action}
              isLatest={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
