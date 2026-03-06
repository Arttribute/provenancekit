import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getOrgBySlug, getOrgProjects } from "@/lib/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CreditCard,
  Zap,
  TrendingUp,
  CheckCircle,
  ArrowUpRight,
  Calendar,
  FolderKanban,
  Key,
} from "lucide-react";

interface Props { params: Promise<{ orgSlug: string }> }

export const metadata: Metadata = { title: "Billing" };

const PLANS = {
  free: {
    label: "Free",
    color: "secondary" as const,
    price: "$0",
    period: "forever",
    limits: { apiCalls: 10_000, projects: 3, apiKeys: 5 },
    features: ["10,000 API calls / month", "3 projects", "5 API keys", "Community support"],
  },
  pro: {
    label: "Pro",
    color: "default" as const,
    price: "$49",
    period: "/ month",
    limits: { apiCalls: 500_000, projects: 20, apiKeys: 50 },
    features: ["500,000 API calls / month", "20 projects", "50 API keys", "Priority support", "Advanced analytics", "Custom webhooks"],
  },
  enterprise: {
    label: "Enterprise",
    color: "outline" as const,
    price: "Custom",
    period: "",
    limits: { apiCalls: Infinity, projects: Infinity, apiKeys: Infinity },
    features: ["Unlimited API calls", "Unlimited projects", "Dedicated SLA", "SSO / SAML", "Custom contracts"],
  },
};

export default async function BillingPage({ params }: Props) {
  const { orgSlug } = await params;

  const user = await getServerUser();
  if (!user) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, user.privyDid);
  if (!orgData) notFound();

  const projects = await getOrgProjects(orgSlug, user.privyDid);
  const currentPlan = (orgData.org.plan as keyof typeof PLANS) ?? "free";
  const plan = PLANS[currentPlan] ?? PLANS.free;

  // Static usage data for now (will be real when usage tracking is wired up)
  const usedApiCalls = 0;
  const usedProjects = projects.length;

  const apiCallsPct = plan.limits.apiCalls === Infinity
    ? 0
    : Math.min((usedApiCalls / plan.limits.apiCalls) * 100, 100);
  const projectsPct = plan.limits.projects === Infinity
    ? 0
    : Math.min((usedProjects / plan.limits.projects) * 100, 100);

  // Mock invoice history
  const invoices = [
    { id: "INV-001", date: "Mar 1, 2026", amount: "$0.00", status: "paid" },
  ];

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your plan and usage for {orgData.org.name}
        </p>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Current Plan
              </CardTitle>
              <CardDescription>Your subscription renews on the 1st of each month</CardDescription>
            </div>
            <Badge variant={plan.color} className="capitalize">{plan.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 mb-6">
            <span className="text-3xl font-bold">{plan.price}</span>
            {plan.period && (
              <span className="text-sm text-muted-foreground mb-1">{plan.period}</span>
            )}
          </div>

          <div className="space-y-1.5 mb-6">
            {plan.features.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                {f}
              </div>
            ))}
          </div>

          {currentPlan !== "enterprise" && (
            <Button className="w-full sm:w-auto">
              <TrendingUp className="h-4 w-4 mr-2" />
              Upgrade Plan
              <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Usage meters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Usage This Month
          </CardTitle>
          <CardDescription>Resets on the 1st of each month</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <UsageMeter
            icon={<Zap className="h-4 w-4 text-yellow-500" />}
            label="API Calls"
            used={usedApiCalls}
            limit={plan.limits.apiCalls}
            pct={apiCallsPct}
          />
          <UsageMeter
            icon={<FolderKanban className="h-4 w-4 text-blue-500" />}
            label="Projects"
            used={usedProjects}
            limit={plan.limits.projects}
            pct={projectsPct}
          />
          <UsageMeter
            icon={<Key className="h-4 w-4 text-purple-500" />}
            label="API Keys"
            used={0}
            limit={plan.limits.apiKeys}
            pct={0}
          />
        </CardContent>
      </Card>

      {/* Plan comparison (upgrade CTA for free/pro) */}
      {currentPlan === "free" && (
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="font-semibold text-sm">Upgrade to Pro</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Get 500K API calls/month, 20 projects, priority support, advanced analytics, and custom webhooks.
          </p>
          <Button size="sm">
            Upgrade to Pro — $49/month
            <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      )}

      {/* Invoice history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No invoices yet</p>
          ) : (
            <div className="divide-y">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{inv.date}</p>
                    <p className="text-xs text-muted-foreground font-mono">{inv.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{inv.amount}</span>
                    <Badge variant="outline" className="text-green-700 border-green-200 capitalize">
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsageMeter({
  icon,
  label,
  used,
  limit,
  pct,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number;
  pct: number;
}) {
  const isUnlimited = limit === Infinity;
  const limitLabel = isUnlimited ? "Unlimited" : limit.toLocaleString();
  const warnColor = pct >= 90 ? "text-red-600" : pct >= 70 ? "text-yellow-600" : "text-foreground";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
        </div>
        <span className={`text-xs font-mono ${warnColor}`}>
          {used.toLocaleString()} / {limitLabel}
        </span>
      </div>
      {!isUnlimited && (
        <Progress value={pct} className="h-1.5" />
      )}
    </div>
  );
}
