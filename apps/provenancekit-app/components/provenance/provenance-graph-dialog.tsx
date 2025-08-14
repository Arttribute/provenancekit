// apps/provenancekit-app/components/provenance-graph-dialog.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { ProvenanceGraphUI } from "@/components/provenance/provenance-graph-ui";
import type { ProvenanceGraph } from "@provenancekit/sdk";

type Props = {
  cid: string;
  depth?: number;
  /** Optional: supply your own trigger. Defaults to a 'View Provenance' button */
  trigger?: React.ReactNode;
  title?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
};

export function ProvenanceGraphDialog({
  cid,
  depth = 10,
  trigger,
  title = "Provenance Graph",
  open,
  onOpenChange,
}: Props) {
  const [data, setData] = useState<ProvenanceGraph | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchGraph = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/provenance/graph?cid=${cid}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || res.statusText);
      }
      const j = (await res.json()) as ProvenanceGraph;
      setData(j);
    } catch (e: any) {
      setErr(e.message || "Failed to load graph");
    } finally {
      setLoading(false);
    }
  };

  // Lazy-load on first open
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const handleOpenChange = (v: boolean) => {
    onOpenChange?.(v);
    if (v && !hasLoadedOnce) {
      setHasLoadedOnce(true);
      fetchGraph();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" size="sm">
            View Provenance
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-full md:max-w-6xl p-0 ">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-white">{title}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-[600px] w-full" />
            </div>
          )}
          {err && (
            <div className="text-red-400 bg-red-950/30 border border-red-800 p-4 rounded">
              {err}
            </div>
          )}
          {data && <ProvenanceGraphUI nodes={data.nodes} edges={data.edges} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
