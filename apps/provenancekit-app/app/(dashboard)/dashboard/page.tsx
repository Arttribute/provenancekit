import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import { getUserOrgs } from "@/lib/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, FolderKanban, Plus, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const orgs = await getUserOrgs(user.privyDid);

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your provenance organizations and projects
          </p>
        </div>
        <Button asChild>
          <Link href="/orgs/new">
            <Plus className="h-4 w-4 mr-2" />
            New Organization
          </Link>
        </Button>
      </div>

      {orgs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Your Organizations
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orgs.map((org) => (
              <Card key={org.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{org.name}</CardTitle>
                        <CardDescription className="text-xs">@{org.slug}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{org.role}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="capitalize">{org.plan}</Badge>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${org.slug}`} className="flex items-center gap-1">
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="border-dashed hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer">
              <Link href="/orgs/new" className="flex h-full items-center justify-center p-6">
                <div className="text-center space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mx-auto">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Create organization</p>
                  <p className="text-xs text-muted-foreground">Set up a new provenance namespace</p>
                </div>
              </Link>
            </Card>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-muted/30 p-6 space-y-3">
        <h2 className="text-sm font-semibold">Quick Start</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickLink icon={<Building2 className="h-4 w-4" />} title="Create an org" description="Set up your team or personal namespace" href="/orgs/new" />
          <QuickLink icon={<FolderKanban className="h-4 w-4" />} title="Start a project" description="Configure storage, IPFS, and blockchain" href="/orgs/new" />
          <QuickLink icon={<ArrowRight className="h-4 w-4" />} title="Read the docs" description="Integrate the SDK in minutes" href="https://docs.provenancekit.com" external />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Building2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">No organizations yet</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Create your first organization to start tracking provenance for your AI-powered projects.
        </p>
      </div>
      <Button asChild>
        <Link href="/orgs/new"><Plus className="h-4 w-4 mr-2" />Create your first org</Link>
      </Button>
    </div>
  );
}

function QuickLink({ icon, title, description, href, external }: { icon: React.ReactNode; title: string; description: string; href: string; external?: boolean }) {
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}
      className="flex items-start gap-3 rounded-lg border bg-background p-4 hover:shadow-sm transition-shadow">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </a>
  );
}
