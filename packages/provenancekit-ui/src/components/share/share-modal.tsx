"use client";

import React, { useState, useCallback } from "react";
import {
  X,
  Link,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  Zap,
  Database,
  Users,
  AlertCircle,
} from "lucide-react";
import type { Action, Resource, Entity } from "@provenancekit/eaa-types";

/*─────────────────────────────────────────────────────────────*\
 | Types                                                         |
\*─────────────────────────────────────────────────────────────*/

export interface RedactionConfig {
  type: "action" | "resource" | "entity";
  targetId: string;
  reason: string;
  label: string;
}

export interface ShareConfig {
  title: string;
  description: string;
  redactions: RedactionConfig[];
  expiresAt?: string;
}

export interface ShareModalProps {
  /** Set to false to close the modal */
  open: boolean;
  onClose: () => void;
  /** Bundle / session items to configure redaction for */
  actions?: Action[];
  resources?: Resource[];
  entities?: Entity[];
  /** Called with the final share config; should return the share URL */
  onCreateShare: (config: ShareConfig) => Promise<string>;
}

/*─────────────────────────────────────────────────────────────*\
 | Helpers                                                       |
\*─────────────────────────────────────────────────────────────*/

function formatActionType(t: string) {
  return t.replace(/^ext:/, "").replace(/@[\d.]+$/, "").replace(/-/g, " ");
}

function truncate(s: string, len = 36) {
  return s.length > len ? `${s.slice(0, len)}…` : s;
}

/*─────────────────────────────────────────────────────────────*\
 | Row component — one toggleable provenance item               |
\*─────────────────────────────────────────────────────────────*/

interface ItemRowProps {
  id: string;
  type: "action" | "resource" | "entity";
  label: string;
  sublabel?: string;
  redacted: boolean;
  redactionReason: string;
  redactionLabel: string;
  onToggle: (id: string, type: "action" | "resource" | "entity") => void;
  onReasonChange: (id: string, reason: string) => void;
  onLabelChange: (id: string, label: string) => void;
}

function ItemRow({
  id,
  type,
  label,
  sublabel,
  redacted,
  redactionReason,
  redactionLabel,
  onToggle,
  onReasonChange,
  onLabelChange,
}: ItemRowProps) {
  const [expanded, setExpanded] = useState(false);

  const typeColor = type === "action" ? "#22c55e" : type === "resource" ? "#3b82f6" : "#a855f7";
  const TypeIcon = type === "action" ? Zap : type === "resource" ? Database : Users;

  return (
    <div
      style={{
        border: `1px solid ${redacted ? "#e2e8f0" : "transparent"}`,
        borderRadius: 10,
        background: redacted ? "#fafafa" : "transparent",
        overflow: "hidden",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {/* Main row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
        }}
      >
        {/* Type icon */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: `rgba(${type === "action" ? "34,197,94" : type === "resource" ? "59,130,246" : "168,85,247"}, 0.1)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <TypeIcon size={13} color={typeColor} />
        </div>

        {/* Label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: redacted ? "#94a3b8" : "#111827", textDecoration: redacted ? "line-through" : "none" }}>
            {truncate(label)}
          </div>
          {sublabel && (
            <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginTop: 1 }}>
              {truncate(sublabel, 28)}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Redact toggle */}
          <button
            type="button"
            onClick={() => onToggle(id, type)}
            title={redacted ? "Show this item" : "Redact this item"}
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              border: `1px solid ${redacted ? "#fca5a5" : "#e2e8f0"}`,
              background: redacted ? "#fef2f2" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {redacted ? <EyeOff size={13} color="#ef4444" /> : <Eye size={13} color="#94a3b8" />}
          </button>

          {/* Expand reason */}
          {redacted && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                border: "1px solid #e2e8f0",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              {expanded ? <ChevronUp size={12} color="#64748b" /> : <ChevronDown size={12} color="#64748b" />}
            </button>
          )}
        </div>
      </div>

      {/* Reason / label inputs (only when redacted + expanded) */}
      {redacted && expanded && (
        <div
          style={{
            padding: "0 12px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            borderTop: "1px solid #f1f5f9",
            paddingTop: 10,
          }}
        >
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
            Display label
            <input
              type="text"
              value={redactionLabel}
              onChange={(e) => onLabelChange(id, e.target.value)}
              placeholder="REDACTED"
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "6px 10px",
                fontSize: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 7,
                outline: "none",
                fontFamily: "monospace",
                color: "#111827",
                background: "#fff",
                boxSizing: "border-box",
              }}
            />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
            Reason (shown to viewers)
            <input
              type="text"
              value={redactionReason}
              onChange={(e) => onReasonChange(id, e.target.value)}
              placeholder="e.g. Proprietary system prompt"
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "6px 10px",
                fontSize: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 7,
                outline: "none",
                color: "#111827",
                background: "#fff",
                boxSizing: "border-box",
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

/*─────────────────────────────────────────────────────────────*\
 | ShareModal                                                    |
\*─────────────────────────────────────────────────────────────*/

/**
 * ShareModal — configure a shareable provenance link.
 *
 * The user can:
 * - Add a title and description for the share
 * - Toggle visibility of individual actions, resources, and entities
 * - Add a reason for each redaction (shown to viewers as a label)
 * - Create the share to get a copyable link
 */
export function ShareModal({
  open,
  onClose,
  actions = [],
  resources = [],
  entities = [],
  onCreateShare,
}: ShareModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // redactedIds: Set of targetIds that are currently marked for redaction
  const [redactedIds, setRedactedIds] = useState<Set<string>>(new Set());
  // Per-item reason and label overrides
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Active section tab
  const [section, setSection] = useState<"actions" | "resources" | "entities">("actions");

  const toggleRedact = useCallback((id: string) => {
    setRedactedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setReason = useCallback((id: string, reason: string) => {
    setReasons((prev) => ({ ...prev, [id]: reason }));
  }, []);

  const setLabel = useCallback((id: string, label: string) => {
    setLabels((prev) => ({ ...prev, [id]: label }));
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const redactions: RedactionConfig[] = [...redactedIds].map((targetId, i) => {
        // Determine type from which list the id belongs to
        const isAction = actions.some((a) => a.id === targetId);
        const isResource = resources.some((r) => r.address?.ref === targetId);
        const type = isAction ? "action" : isResource ? "resource" : "entity";
        return {
          id: `r-${i}`,
          type,
          targetId,
          reason: reasons[targetId] ?? "",
          label: labels[targetId] ?? "REDACTED",
        };
      });

      const url = await onCreateShare({ title, description, redactions });
      setShareUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — select text
    }
  };

  if (!open) return null;

  const TABS: { key: typeof section; label: string; count: number }[] = [
    { key: "actions", label: "Actions", count: actions.length },
    { key: "resources", label: "Resources", count: resources.length },
    { key: "entities", label: "Entities", count: entities.length },
  ];

  const totalRedacted = redactedIds.size;

  return (
    // Backdrop
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "18px 20px",
            borderBottom: "1px solid #f1f5f9",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "28%",
              background: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Link size={14} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Share Provenance</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              Generate a public link — choose what to show or redact
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              border: "1px solid #e2e8f0",
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={13} color="#64748b" />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {shareUrl ? (
            /* ── Success state ── */
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <Check size={22} color="#22c55e" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Share created!</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
                {totalRedacted > 0
                  ? `${totalRedacted} item${totalRedacted !== 1 ? "s are" : " is"} redacted. Viewers will see [REDACTED] blocks for those.`
                  : "All provenance items are visible to anyone with the link."}
              </div>

              {/* URL field */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "10px 14px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: "#475569",
                    fontFamily: "monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                  }}
                >
                  {shareUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 7,
                    border: "none",
                    background: copied ? "#22c55e" : "#111827",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    transition: "background 0.15s",
                  }}
                >
                  {copied ? <Check size={11} /> : <Link size={11} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          ) : (
            /* ── Config state ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Title */}
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Title (optional)</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AI-assisted research summary"
                  style={{
                    padding: "8px 12px",
                    fontSize: 13,
                    border: "1px solid #e2e8f0",
                    borderRadius: 9,
                    outline: "none",
                    color: "#111827",
                    background: "#fff",
                  }}
                />
              </label>

              {/* Description */}
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Description (optional)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the context of this provenance record…"
                  rows={2}
                  style={{
                    padding: "8px 12px",
                    fontSize: 13,
                    border: "1px solid #e2e8f0",
                    borderRadius: 9,
                    outline: "none",
                    color: "#111827",
                    background: "#fff",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </label>

              {/* Selective disclosure */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>
                  Selective disclosure
                  {totalRedacted > 0 && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#ef4444",
                        background: "#fef2f2",
                        border: "1px solid #fca5a5",
                        borderRadius: 8,
                        padding: "1px 6px",
                      }}
                    >
                      {totalRedacted} redacted
                    </span>
                  )}
                </div>

                {/* Section tabs */}
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    marginBottom: 10,
                    background: "#f8fafc",
                    borderRadius: 10,
                    padding: 4,
                    border: "1px solid #f1f5f9",
                  }}
                >
                  {TABS.filter((t) => t.count > 0).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSection(tab.key)}
                      style={{
                        flex: 1,
                        padding: "5px 8px",
                        borderRadius: 7,
                        border: "none",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: section === tab.key ? "#fff" : "transparent",
                        color: section === tab.key ? "#111827" : "#64748b",
                        boxShadow: section === tab.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      {tab.label}
                      <span
                        style={{
                          marginLeft: 5,
                          fontSize: 10,
                          color: "#94a3b8",
                        }}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Items list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {section === "actions" && actions.map((action) => (
                    <ItemRow
                      key={action.id}
                      id={action.id ?? ""}
                      type="action"
                      label={formatActionType(action.type ?? "action")}
                      sublabel={action.timestamp ? new Date(action.timestamp).toLocaleString() : undefined}
                      redacted={redactedIds.has(action.id ?? "")}
                      redactionReason={reasons[action.id ?? ""] ?? ""}
                      redactionLabel={labels[action.id ?? ""] ?? ""}
                      onToggle={(id) => toggleRedact(id)}
                      onReasonChange={setReason}
                      onLabelChange={setLabel}
                    />
                  ))}
                  {section === "resources" && resources.map((resource) => {
                    const ref = resource.address?.ref ?? "";
                    return (
                      <ItemRow
                        key={ref}
                        id={ref}
                        type="resource"
                        label={resource.type ?? "resource"}
                        sublabel={ref}
                        redacted={redactedIds.has(ref)}
                        redactionReason={reasons[ref] ?? ""}
                        redactionLabel={labels[ref] ?? ""}
                        onToggle={(id) => toggleRedact(id)}
                        onReasonChange={setReason}
                        onLabelChange={setLabel}
                      />
                    );
                  })}
                  {section === "entities" && entities.map((entity) => (
                    <ItemRow
                      key={entity.id}
                      id={entity.id ?? ""}
                      type="entity"
                      label={entity.name ?? entity.role ?? "entity"}
                      sublabel={entity.id}
                      redacted={redactedIds.has(entity.id ?? "")}
                      redactionReason={reasons[entity.id ?? ""] ?? ""}
                      redactionLabel={labels[entity.id ?? ""] ?? ""}
                      onToggle={(id) => toggleRedact(id)}
                      onReasonChange={setReason}
                      onLabelChange={setLabel}
                    />
                  ))}
                  {(section === "actions" && actions.length === 0) ||
                  (section === "resources" && resources.length === 0) ||
                  (section === "entities" && entities.length === 0) ? (
                    <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>
                      No {section} in this provenance record.
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "10px 12px",
                    background: "#fef2f2",
                    border: "1px solid #fca5a5",
                    borderRadius: 9,
                    fontSize: 12,
                    color: "#dc2626",
                  }}
                >
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!shareUrl && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              {totalRedacted === 0
                ? "All items visible"
                : `${totalRedacted} item${totalRedacted !== 1 ? "s" : ""} will be redacted`}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9,
                  border: "1px solid #e2e8f0",
                  background: "transparent",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                style={{
                  padding: "8px 18px",
                  borderRadius: 9,
                  border: "none",
                  background: "#111827",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {loading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Link size={12} />}
                {loading ? "Creating…" : "Create share link"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
