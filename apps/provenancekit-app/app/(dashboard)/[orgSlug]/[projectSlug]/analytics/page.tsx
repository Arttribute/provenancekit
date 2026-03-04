import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug, getProjectUsageSummary } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Activity, CheckCircle, AlertTriangle } from "lucide-react";

interface Props {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ params }: Props) {
  const { orgSlug, projectSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, session.user.id);
  if (!orgData) notFound();

  const project = await getProjectBySlug(orgData.org.id, projectSlug);
  if (!project) notFound();

  const usage = await getProjectUsageSummary(project.id);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          API usage and provenance activity — last 30 days
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Total API Calls"
          value={usage.totalCalls.toLocaleString()}
        />
        <StatCard
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          label="Success Rate"
          value={`${usage.successRate.toFixed(1)}%`}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
          label="Error Rate"
          value={`${(100 - usage.successRate).toFixed(1)}%`}
        />
      </div>

      {/* Chart placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            API Calls Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 rounded-lg bg-muted/30 border border-dashed">
            <p className="text-sm text-muted-foreground">
              Chart visualization coming soon
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Endpoint breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoint Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No usage data yet — start using the API to see analytics here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wider">
            {label}
          </span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
