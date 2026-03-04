"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProvenanceGraph } from "@provenancekit/sdk";
import { useProvenanceKit } from "../context/provenance-kit-provider";

export interface UseProvenanceGraphResult {
  data: ProvenanceGraph | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useProvenanceGraph(
  cid: string | null | undefined,
  options?: { depth?: number; enabled?: boolean }
): UseProvenanceGraphResult {
  const { pk } = useProvenanceKit();
  const [data, setData] = useState<ProvenanceGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const enabled = options?.enabled !== false;
  const depth = options?.depth ?? 10;

  const fetchData = useCallback(async () => {
    if (!cid || !pk || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await pk.graph(cid, depth);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [cid, pk, depth, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
