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
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
        active
          ? "bg-[var(--pk-foreground)] text-[var(--pk-surface)]"
          : "text-[var(--pk-muted-foreground)] hover:text-[var(--pk-foreground)] hover:bg-[var(--pk-surface-muted)]"
      )}
    >
      {label}
      <span
        className={cn(
          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
          active
            ? "bg-[var(--pk-surface)]/20 text-[var(--pk-surface)]"
            : "bg-[var(--pk-surface-muted)] text-[var(--pk-muted-foreground)]"
        )}
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
  const tabs: { id: Tab; label: string; count: number; enabled: boolean }[] = (
    [
      { id: "resources"   as Tab, label: "Resources",   count: bundle.resources.length,    enabled: !!showResources && bundle.resources.length > 0 },
      { id: "actions"     as Tab, label: "Actions",     count: bundle.actions.length,      enabled: !!showActions && bundle.actions.length > 0 },
      { id: "entities"    as Tab, label: "Entities",    count: bundle.entities.length,     enabled: !!showEntities && bundle.entities.length > 0 },
      { id: "attribution" as Tab, label: "Attribution", count: bundle.attributions.length, enabled: !!showAttributions && bundle.attributions.length > 0 },
      { id: "graph"       as Tab, label: "Graph",       count: bundle.resources.length + bundle.actions.length + bundle.entities.length, enabled: !!showGraph },
    ] as { id: Tab; label: string; count: number; enabled: boolean }[]
  ).filter((t) => t.enabled);

  const [activeTab, setActiveTab] = useState<Tab>(tabs[0]?.id ?? "resources");

  if (tabs.length === 0) return null;

  const resolvedTab = tabs.find((t) => t.id === activeTab) ? activeTab : (tabs[0]?.id ?? "resources");

  return (
    <div className="space-y-4">
      {tabs.length > 1 && (
        <div
          className="flex items-center gap-1 p-1 rounded-xl flex-wrap"
          style={{
            backgroundColor: "var(--pk-surface-muted)",
            border: "1px solid var(--pk-surface-border)",
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
          <div className="space-y-2">
            {bundle.resources.map((resource, i) => (
              <ResourceCard key={resource.address?.ref ?? i} resource={resource} />
            ))}
          </div>
        )}
        {resolvedTab === "actions" && (
          <div className="space-y-2">
            {bundle.actions.map((action, i) => (
              <ActionCard key={action.id ?? i} action={action} />
            ))}
          </div>
        )}
        {resolvedTab === "entities" && (
          <div className="space-y-2">
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
          <ProvenanceGraph nodes={[]} edges={[]} height={graphHeight ?? 420} />
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
        <div className="h-10 rounded-xl bg-[var(--pk-surface-muted)]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-[var(--pk-surface-muted)]" />
        ))}
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div
        className={cn("rounded-xl p-4 text-sm", className)}
        style={{
          backgroundColor: "rgba(239,68,68,0.06)",
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
