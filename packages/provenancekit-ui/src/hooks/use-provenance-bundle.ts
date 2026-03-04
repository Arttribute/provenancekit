"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProvenanceBundle } from "@provenancekit/sdk";
import { useProvenanceKit } from "../context/provenance-kit-provider";

export interface UseProvenanceBundleResult {
  data: ProvenanceBundle | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useProvenanceBundle(
  cid: string | null | undefined,
  options?: { enabled?: boolean }
): UseProvenanceBundleResult {
  const { pk } = useProvenanceKit();
  const [data, setData] = useState<ProvenanceBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const enabled = options?.enabled !== false;

  const fetchData = useCallback(async () => {
    if (!cid || !pk || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await pk.bundle(cid);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [cid, pk, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
