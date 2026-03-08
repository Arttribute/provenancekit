"use client";

import React, { useState } from "react";
import { cn } from "../../lib/utils";
import { EntityCard } from "./entity-card";
import { ActionCard } from "./action-card";
import { ResourceCard } from "./resource-card";
import { AttributionList } from "./attribution-list";
import { ProvenanceGraph } from "../graph/provenance-graph";
import { useProvenanceBundle } from "../../hooks/use-provenance-bundle";
import type { ProvenanceBundle } from "@provenancekit/sdk";

type Tab = "resources" | "actions" | "entities" | "attribution" | "graph";

interface ProvenanceBundleViewProps {
  cid?: string;
  bundle?: ProvenanceBundle;
  showEntities?: boolean;
  showActions?: boolean;
  showResources?: boolean;
  showAttributions?: boolean;
  showGraph?: boolean;
  graphHeight?: number;
  className?: string;
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        border: "none",
        cursor: "pointer",
        background: active ? "#111827" : "transparent",
        color: active ? "#fff" : "#64748b",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "#f1f5f9";
          (e.currentTarget as HTMLElement).style.color = "#111827";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "#64748b";
        }
      }}
    >
      {label}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "1px 6px",
          borderRadius: 99,
          background: active ? "rgba(255,255,255,0.2)" : "#f1f5f9",
          color: active ? "#fff" : "#94a3b8",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function BundleContent({
  bundle,
  showEntities,
  showActions,
  showResources,
  showAttributions,
  showGraph,
  graphHeight,
}: Omit<ProvenanceBundleViewProps, "cid"> & { bundle: ProvenanceBundle }) {
  const tabs = (
    [
      { id: "resources" as Tab, label: "Resources", count: bundle.resources.length, enabled: !!showResources && bundle.resources.length > 0 },
      { id: "actions" as Tab, label: "Actions", count: bundle.actions.length, enabled: !!showActions && bundle.actions.length > 0 },
      { id: "entities" as Tab, label: "Entities", count: bundle.entities.length, enabled: !!showEntities && bundle.entities.length > 0 },
      { id: "attribution" as Tab, label: "Attribution", count: bundle.attributions.length, enabled: !!showAttributions && bundle.attributions.length > 0 },
      { id: "graph" as Tab, label: "Graph", count: bundle.resources.length + bundle.actions.length + bundle.entities.length, enabled: !!showGraph },
    ] as { id: Tab; label: string; count: number; enabled: boolean }[]
  ).filter((t) => t.enabled);

  const [activeTab, setActiveTab] = useState<Tab>(tabs[0]?.id ?? "resources");

  if (tabs.length === 0) return null;

  const resolvedTab = tabs.find((t) => t.id === activeTab) ? activeTab : (tabs[0]?.id ?? "resources");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {tabs.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: 4,
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            flexWrap: "wrap",
          }}
        >
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              label={tab.label}
              count={tab.count}
              active={resolvedTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      )}

      <div>
        {resolvedTab === "resources" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bundle.resources.map((resource, i) => (
              <ResourceCard key={resource.address?.ref ?? i} resource={resource} />
            ))}
          </div>
        )}
        {resolvedTab === "actions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bundle.actions.map((action, i) => (
              <ActionCard key={action.id ?? i} action={action} />
            ))}
          </div>
        )}
        {resolvedTab === "entities" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bundle.entities.map((entity, i) => (
              <EntityCard key={entity.id ?? i} entity={entity} />
            ))}
          </div>
        )}
        {resolvedTab === "attribution" && (
          <AttributionList
            attributions={bundle.attributions}
            entities={bundle.entities}
            showContribution
          />
        )}
        {resolvedTab === "graph" && (
          <ProvenanceGraph nodes={[]} edges={[]} height={graphHeight ?? 500} />
        )}
      </div>
    </div>
  );
}

export function ProvenanceBundleView({
  cid,
  bundle: bundleProp,
  showEntities = true,
  showActions = true,
  showResources = true,
  showAttributions = true,
  showGraph = false,
  graphHeight,
  className,
}: ProvenanceBundleViewProps) {
  const { data: fetchedBundle, loading, error } = useProvenanceBundle(
    bundleProp ? null : cid,
    { enabled: !bundleProp && !!cid }
  );

  const bundle = bundleProp ?? fetchedBundle;

  if (loading && !bundle) {
    return (
      <div className={cn("animate-pulse space-y-3", className)}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 72,
              borderRadius: 12,
              background: "#f1f5f9",
            }}
          />
        ))}
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div
        className={cn("rounded-xl p-4 text-sm", className)}
        style={{
          background: "rgba(239,68,68,0.05)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "#ef4444",
        }}
      >
        {error.message}
      </div>
    );
  }

  if (!bundle) return null;

  return (
    <div className={className}>
      <BundleContent
        bundle={bundle}
        showEntities={showEntities}
        showActions={showActions}
        showResources={showResources}
        showAttributions={showAttributions}
        showGraph={showGraph}
        graphHeight={graphHeight}
      />
    </div>
  );
}
