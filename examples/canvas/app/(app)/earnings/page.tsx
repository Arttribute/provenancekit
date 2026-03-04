"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, Users, FileText } from "lucide-react";
import type { CreatorEarning } from "@/types";

interface EarningSummary {
  total: string;
  thisMonth: string;
  postCount: number;
  earnings: CreatorEarning[];
}

export default function EarningsPage() {
  const { user } = usePrivy();

  const { data, isLoading } = useQuery<EarningSummary>({
    queryKey: ["earnings", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/earnings?userId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const stats = [
    {
      label: "Total Earned",
      value: data ? `$${(parseFloat(data.total || "0") / 1e6).toFixed(2)}` : "$0.00",
      sub: "USDC lifetime",
      icon: DollarSign,
    },
    {
      label: "This Month",
      value: data ? `$${(parseFloat(data.thisMonth || "0") / 1e6).toFixed(2)}` : "$0.00",
      sub: "USDC",
      icon: TrendingUp,
    },
    {
      label: "Monetized Posts",
      value: data?.postCount ?? 0,
      sub: "with splits contracts",
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Earnings</h1>
        <p className="text-sm text-muted-foreground">
          Revenue distributed on-chain via 0xSplits based on your provenance contributions
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Earnings history */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-medium">Distribution History</h2>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : !data?.earnings.length ? (
          <div className="p-8 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No earnings yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Publish monetized posts to start earning when others view or remix your work
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {data.earnings.map((earning) => (
              <div key={earning._id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium capitalize">{earning.type}</p>
                  <p className="text-xs text-muted-foreground">
                    Post {earning.postId.slice(0, 8)}…
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">
                    +${(parseFloat(earning.amount) / 1e6).toFixed(4)} USDC
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {earning.txHash.slice(0, 10)}…
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
        <h2 className="text-sm font-medium">How earnings work</h2>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            1. When you post content, ProvenanceKit records your authorship on-chain.
          </p>
          <p>
            2. If your content is remixed, the provenance chain tracks all contributors.
          </p>
          <p>
            3. When monetized content earns revenue, a 0xSplits contract distributes it
            automatically to everyone in the provenance chain based on their contribution.
          </p>
          <p>
            4. Payments are direct on-chain — no intermediary holds your funds.
          </p>
        </div>
      </div>
    </div>
  );
}
