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

type Section = "entities" | "actions" | "resources" | "attributions" | "graph";

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

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-sm font-semibold text-[var(--pk-foreground)]">{title}</h3>
      <span className="text-xs text-[var(--pk-muted-foreground)] bg-[var(--pk-surface-muted)] px-1.5 py-0.5 rounded-full">
        {count}
      </span>
    </div>
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
  return (
    <div className="space-y-6">
      {showGraph && (
        <section>
          <SectionHeader title="Provenance Graph" count={bundle.resources.length + bundle.actions.length + bundle.entities.length} />
          <ProvenanceGraph
            nodes={[]}
            edges={[]}
            height={graphHeight ?? 400}
          />
        </section>
      )}

      {showResources && bundle.resources.length > 0 && (
        <section>
          <SectionHeader title="Resources" count={bundle.resources.length} />
          <div className="space-y-2">
            {bundle.resources.map((resource, i) => (
              <ResourceCard key={resource.address?.ref ?? i} resource={resource} />
            ))}
          </div>
        </section>
      )}

      {showActions && bundle.actions.length > 0 && (
        <section>
          <SectionHeader title="Actions" count={bundle.actions.length} />
          <div className="space-y-2">
            {bundle.actions.map((action, i) => (
              <ActionCard key={action.id ?? i} action={action} />
            ))}
          </div>
        </section>
      )}

      {showEntities && bundle.entities.length > 0 && (
        <section>
          <SectionHeader title="Entities" count={bundle.entities.length} />
          <div className="space-y-2">
            {bundle.entities.map((entity, i) => (
              <EntityCard key={entity.id ?? i} entity={entity} />
            ))}
          </div>
        </section>
      )}

      {showAttributions && bundle.attributions.length > 0 && (
        <section>
          <SectionHeader title="Attribution" count={bundle.attributions.length} />
          <AttributionList
            attributions={bundle.attributions}
            entities={bundle.entities}
            showContribution
          />
        </section>
      )}
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
          <div key={i} className="h-20 rounded-lg bg-[var(--pk-surface-muted)]" />
        ))}
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div className={cn("rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600", className)}>
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
