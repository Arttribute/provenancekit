"use client";

import React, { useEffect, useRef } from "react";
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className={className}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: i === 1 ? 48 : 56,
              borderRadius: 12,
              background: "var(--pk-surface-muted, #f8fafc)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (!session && error) {
    return (
      <div
        className={className}
        style={{
          borderRadius: 12,
          border: "1px solid rgba(220,38,38,0.3)",
          background: "rgba(220,38,38,0.05)",
          padding: "12px 14px",
          fontSize: 13,
          color: "#dc2626",
        }}
      >
        {error.message}
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className={className}
        style={{
          borderRadius: 12,
          border: "1px solid var(--pk-surface-border, #e2e8f0)",
          padding: "24px",
          textAlign: "center",
          fontSize: 14,
          color: "var(--pk-muted-foreground, #64748b)",
        }}
      >
        No session data
      </div>
    );
  }

  // Show latest actions first, capped at maxActions
  const actions = [...session.actions].reverse().slice(0, maxActions);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} className={className}>
      <TrackerSessionHeader session={session} />

      {actions.length === 0 ? (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid var(--pk-surface-border, #e2e8f0)",
            padding: "24px",
            textAlign: "center",
            fontSize: 14,
            color: "var(--pk-muted-foreground, #64748b)",
          }}
        >
          No actions recorded yet. Waiting…
        </div>
      ) : (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid var(--pk-surface-border, #e2e8f0)",
            background: "var(--pk-surface, #fff)",
            padding: "16px 16px 0",
          }}
        >
          {actions.map((action, i) => (
            <TrackerActionItem
              key={action.id ?? i}
              action={action}
              isLatest={i === 0}
              isLast={i === actions.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
