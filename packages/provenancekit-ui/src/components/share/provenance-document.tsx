"use client";

import React, { useState } from "react";
import {
  Calendar,
  Users,
  Zap,
  Database,
  Share2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
} from "lucide-react";
import { EntityCard } from "../bundle/entity-card";
import { ActionCard } from "../bundle/action-card";
import { ResourceCard } from "../bundle/resource-card";
import { AttributionList } from "../bundle/attribution-list";
import { ProvenanceGraph } from "../graph/provenance-graph";
import { RedactedItem } from "./redacted-item";
import type { Action, Resource, Entity, Attribution } from "@provenancekit/eaa-types";

/*─────────────────────────────────────────────────────────────*\
 | Types                                                         |
\*─────────────────────────────────────────────────────────────*/

/** An item that has been redacted by the share author. */
export interface RedactedMarker {
  _redacted: true;
  _redactedLabel?: string;
  _redactedReason?: string;
}

export type MaybeRedactedAction   = (Action & { _redacted?: false }) | (Partial<Action> & RedactedMarker);
export type MaybeRedactedResource = (Resource & { _redacted?: false }) | (Partial<Resource> & RedactedMarker);
export type MaybeRedactedEntity   = (Entity & { _redacted?: false }) | (Partial<Entity> & RedactedMarker);

/** A single redacted item descriptor returned by the share API */
export interface RedactedItemDescriptor {
  key: string;           // "action:<id>" | "resource:<ref>" | "entity:<id>"
  type: string;
  id: string;
  label: string;
  reason?: string;
  /** SHA-256 commitment from the SD document — proves item exists in original */
  commitment?: string;
}

/** The share payload returned by GET /p/shares/:shareId */
export interface ShareData {
  shareId: string;
  title?: string | null;
  description?: string | null;
  cid?: string | null;
  sessionId?: string | null;
  /** Descriptors for every redacted item (with commitment digests) */
  redactedItems: RedactedItemDescriptor[];
  redactionCount: number;
  viewCount: number;
  createdAt: string;
  expiresAt?: string | null;
  /** SD document with all item digests (public commitment) */
  sdDocument?: { version: string; digests: { key: string; digest: string }[]; issuedAt: string; signature: string } | null;
  bundle?: {
    resources: MaybeRedactedResource[];
    actions: MaybeRedactedAction[];
    entities: MaybeRedactedEntity[];
    attributions: Attribution[];
  } | null;
  session?: {
    sessionId: string;
    actions: MaybeRedactedAction[];
    resources: MaybeRedactedResource[];
    entities: MaybeRedactedEntity[];
    attributions: Attribution[];
    summary: { actions: number; resources: number; entities: number; attributions: number };
  } | null;
}

export interface ProvenanceDocumentProps {
  share: ShareData;
  /** Height for the graph section in px */
  graphHeight?: number;
}

/*─────────────────────────────────────────────────────────────*\
 | Section component                                             |
\*─────────────────────────────────────────────────────────────*/

function Section({
  title,
  icon,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ color: "#64748b" }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#111827" }}>{title}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#64748b",
            background: "#f1f5f9",
            borderRadius: 10,
            padding: "2px 8px",
            marginRight: 8,
          }}
        >
          {count}
        </span>
        {open ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
      </button>

      {open && (
        <div
          style={{
            borderTop: "1px solid #f1f5f9",
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/*─────────────────────────────────────────────────────────────*\
 | Redaction notice banner                                       |
\*─────────────────────────────────────────────────────────────*/

function RedactionNotice({
  count,
  committedTotal,
}: {
  count: number;
  committedTotal?: number;
}) {
  if (count === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 14px",
        background: "#fafafa",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        fontSize: 12,
        color: "#475569",
      }}
    >
      <Eye size={14} color="#94a3b8" style={{ marginTop: 1, flexShrink: 0 }} />
      <span>
        {count === 1
          ? "1 item in this provenance record has been redacted by the author."
          : `${count} items in this provenance record have been redacted by the author.`}{" "}
        {committedTotal !== undefined && (
          <>
            The author cryptographically committed to{" "}
            <strong style={{ color: "#374151" }}>{committedTotal} total items</strong> — each
            redacted item shows its SHA-256 commitment digest, proving it exists in the original
            record.{" "}
          </>
        )}
        Redacted items appear as{" "}
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            fontWeight: 700,
            color: "#64748b",
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          REDACTED
        </span>{" "}
        blocks.
      </span>
    </div>
  );
}

/*─────────────────────────────────────────────────────────────*\
 | Main component                                                |
\*─────────────────────────────────────────────────────────────*/

/**
 * ProvenanceDocument — full-page provenance display for share links.
 *
 * Renders a rich, publicly-viewable provenance document with:
 * - Header (title, description, metadata)
 * - Redaction notice (if any items are redacted)
 * - All provenance sections (actions, resources, entities, attribution, graph)
 * - Clearly labeled [REDACTED] blocks where the author chose to redact
 */
export function ProvenanceDocument({ share, graphHeight = 520 }: ProvenanceDocumentProps) {
  // Prefer session data (richer) over bundle; fall back to bundle
  const data = share.session ?? share.bundle;
  const actions    = data?.actions ?? [];
  const resources  = data?.resources ?? [];
  const entities   = data?.entities ?? [];
  const attributions = data?.attributions ?? [];

  const isRedacted = (item: { _redacted?: boolean }) => item._redacted === true;

  // Build a lookup map from item type+id → redacted item descriptor (for commitments)
  const redactedMap = new Map<string, RedactedItemDescriptor>(
    (share.redactedItems ?? []).map((ri) => [ri.key, ri])
  );
  const committedTotal = share.sdDocument?.digests.length;

  function getRedactedDescriptor(type: "action" | "resource" | "entity", id: string) {
    return redactedMap.get(`${type}:${id}`);
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", color: "#111827" }}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          borderRadius: 16,
          padding: "28px 32px",
          marginBottom: 24,
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
          {/* Pr badge */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "28%",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Pr</span>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              Provenance Record
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#fff", lineHeight: 1.3 }}>
              {share.title ?? "Untitled Provenance Record"}
            </h1>
            {share.description && (
              <p style={{ fontSize: 13, color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.5 }}>
                {share.description}
              </p>
            )}
          </div>
        </div>

        {/* Metadata row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 14 }}>
          <MetaChip icon={<Calendar size={11} />} label={new Date(share.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
          <MetaChip icon={<Zap size={11} />} label={`${actions.length} action${actions.length !== 1 ? "s" : ""}`} />
          <MetaChip icon={<Database size={11} />} label={`${resources.length} resource${resources.length !== 1 ? "s" : ""}`} />
          <MetaChip icon={<Users size={11} />} label={`${entities.length} entit${entities.length !== 1 ? "ies" : "y"}`} />
          {share.redactionCount > 0 && (
            <MetaChip
              icon={<Eye size={11} />}
              label={`${share.redactionCount} redacted`}
              muted
            />
          )}
          {share.cid && (
            <MetaChip
              icon={<Share2 size={11} />}
              label={`CID: ${share.cid.slice(0, 10)}…`}
              mono
            />
          )}
        </div>
      </div>

      {/* ── Redaction notice ─────────────────────────────────── */}
      {share.redactionCount > 0 && (
        <div style={{ marginBottom: 16 }}>
          <RedactionNotice count={share.redactionCount} committedTotal={committedTotal} />
        </div>
      )}

      {/* ── Content sections ─────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Actions */}
        {actions.length > 0 && (
          <Section title="Actions" icon={<Zap size={15} />} count={actions.length}>
            {actions.map((action, i) => {
              const id = (action as { id?: string }).id ?? String(i);
              if (isRedacted(action)) {
                const desc = getRedactedDescriptor("action", id);
                return (
                  <RedactedItem
                    key={id}
                    label={desc?.label ?? (action as RedactedMarker)._redactedLabel}
                    reason={desc?.reason ?? (action as RedactedMarker)._redactedReason}
                    commitment={desc?.commitment}
                  />
                );
              }
              return <ActionCard key={id} action={action as Action} />;
            })}
          </Section>
        )}

        {/* Resources */}
        {resources.length > 0 && (
          <Section
            title="Resources"
            icon={<Database size={15} />}
            count={resources.length}
            defaultOpen={actions.length === 0}
          >
            {resources.map((resource, i) => {
              const ref = (resource as { address?: { ref?: string } }).address?.ref ?? String(i);
              if (isRedacted(resource)) {
                const desc = getRedactedDescriptor("resource", ref);
                return (
                  <RedactedItem
                    key={ref}
                    label={desc?.label ?? (resource as RedactedMarker)._redactedLabel}
                    reason={desc?.reason ?? (resource as RedactedMarker)._redactedReason}
                    commitment={desc?.commitment}
                  />
                );
              }
              return <ResourceCard key={ref} resource={resource as Resource} />;
            })}
          </Section>
        )}

        {/* Entities */}
        {entities.length > 0 && (
          <Section title="Entities" icon={<Users size={15} />} count={entities.length} defaultOpen={false}>
            {entities.map((entity, i) => {
              const id = (entity as { id?: string }).id ?? String(i);
              if (isRedacted(entity)) {
                const desc = getRedactedDescriptor("entity", id);
                return (
                  <RedactedItem
                    key={id}
                    label={desc?.label ?? (entity as RedactedMarker)._redactedLabel}
                    reason={desc?.reason ?? (entity as RedactedMarker)._redactedReason}
                    commitment={desc?.commitment}
                  />
                );
              }
              return <EntityCard key={id} entity={entity as Entity} />;
            })}
          </Section>
        )}

        {/* Attribution */}
        {attributions.length > 0 && (
          <Section
            title="Attribution"
            icon={<Users size={15} />}
            count={attributions.length}
            defaultOpen={false}
          >
            <AttributionList attributions={attributions as Attribution[]} entities={entities.filter((e) => !isRedacted(e)) as Entity[]} />
          </Section>
        )}

        {/* Graph */}
        {(share.cid || (share.session && resources.length > 0)) && (
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 18px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <ExternalLink size={15} color="#64748b" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Provenance Graph</span>
            </div>
            <div style={{ height: graphHeight }}>
              {share.cid ? (
                <ProvenanceGraph cid={share.cid} depth={20} height={graphHeight} />
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94a3b8",
                    fontSize: 13,
                  }}
                >
                  Graph available when a resource CID is linked to this share.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/*─────────────────────────────────────────────────────────────*\
 | MetaChip helper                                               |
\*─────────────────────────────────────────────────────────────*/

function MetaChip({
  icon,
  label,
  muted = false,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        color: muted ? "#64748b" : "#94a3b8",
        fontFamily: mono ? "monospace" : "inherit",
      }}
    >
      {icon}
      {label}
    </div>
  );
}
