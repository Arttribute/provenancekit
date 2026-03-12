"use client";

import { Badge } from "@/components/ui/badge";
import type { MgmtUsageLog } from "@/lib/management-client";

interface ActivityLogProps {
  logs: MgmtUsageLog[];
}

function statusVariant(code: number | null): "default" | "secondary" | "destructive" | "outline" {
  if (!code) return "outline";
  if (code >= 200 && code < 300) return "secondary";
  if (code >= 400) return "destructive";
  return "outline";
}

function statusColor(code: number | null): string {
  if (!code) return "text-muted-foreground";
  if (code >= 200 && code < 300) return "text-emerald-700";
  if (code >= 500) return "text-red-700";
  if (code >= 400) return "text-amber-700";
  return "text-muted-foreground";
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }) + " " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityLog({ logs }: ActivityLogProps) {
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 rounded-lg bg-muted/30 border border-dashed">
        <p className="text-sm text-muted-foreground">
          No activity yet — API calls will appear here once your app starts using this project&apos;s key
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-32">Time</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-14">Status</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Endpoint</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">Resource</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="px-3 py-2">
                  <span className={`font-mono font-semibold tabular-nums ${statusColor(log.statusCode)}`}>
                    {log.statusCode ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono truncate max-w-xs">
                  {log.endpoint}
                </td>
                <td className="px-3 py-2">
                  {log.resourceType && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                      {log.resourceType}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
