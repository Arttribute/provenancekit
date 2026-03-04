"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SessionProvenance } from "@provenancekit/sdk";
import { useProvenanceKit } from "../context/provenance-kit-provider";

export interface UseSessionProvenanceResult {
  data: SessionProvenance | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSessionProvenance(
  sessionId: string | null | undefined,
  options?: {
    enabled?: boolean;
    /** Poll interval in ms. Set to 0 or undefined to disable polling. */
    pollInterval?: number;
  }
): UseSessionProvenanceResult {
  const { pk } = useProvenanceKit();
  const [data, setData] = useState<SessionProvenance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enabled = options?.enabled !== false;
  const pollInterval = options?.pollInterval;

  const fetchData = useCallback(async () => {
    if (!sessionId || !pk || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await pk.sessionProvenance(sessionId);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [sessionId, pk, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling
  useEffect(() => {
    if (!pollInterval || pollInterval <= 0) return;
    intervalRef.current = setInterval(fetchData, pollInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, pollInterval]);

  return { data, loading, error, refetch: fetchData };
}
