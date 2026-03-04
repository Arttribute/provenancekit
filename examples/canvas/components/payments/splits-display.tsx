"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

interface SplitsDisplayProps {
  postId: string;
  contractAddress?: string;
}

interface Recipient {
  wallet: string;
  share: number; // basis points (10000 = 100%)
  entityId?: string;
}

export function SplitsDisplay({ postId, contractAddress }: SplitsDisplayProps) {
  const { data, isLoading } = useQuery<{ recipients: Recipient[] }>({
    queryKey: ["splits", postId],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${postId}/splits`);
      if (!res.ok) throw new Error("No splits data");
      return res.json();
    },
    enabled: !!contractAddress,
  });

  if (!contractAddress) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-sm font-medium">Revenue Split</p>
        <p className="text-xs text-muted-foreground">
          No splits contract deployed for this post.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Revenue Split</p>
        <a
          href={`https://app.splits.org/accounts/${contractAddress}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View on Splits <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <p className="font-mono text-xs text-muted-foreground break-all">{contractAddress}</p>

      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-7 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        data?.recipients && (
          <div className="space-y-1.5">
            {data.recipients.map((r) => (
              <div key={r.wallet} className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">
                  {r.wallet.slice(0, 6)}…{r.wallet.slice(-4)}
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-1.5 rounded-full bg-primary/60"
                    style={{ width: `${(r.share / 100).toFixed(0)}px`, minWidth: 4, maxWidth: 80 }}
                  />
                  <span className="font-medium">{(r.share / 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
