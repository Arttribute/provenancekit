import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug, getProjectApiKeys, getProjectUsageSummary } from "@/lib/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Key, BarChart3, Database, GitBranch, Link2, Plus, Activity, CheckCircle } from "lucide-react";

interface Props { params: Promise<{ orgSlug: string; projectSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectSlug } = await params;
  return { title: projectSlug };
}

export default async function ProjectPage({ params }: Props) {
  const { orgSlug, projectSlug } = await params;
  const user = await getServerUser();
  if (!user) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, user.privyDid);
  if (!orgData) notFound();

  const project = await getProjectBySlug(String(orgData.org._id), projectSlug);
  if (!project) notFound();

  const projectId = String(project._id);
  const [keys, usage] = await Promise.all([
    getProjectApiKeys(projectId),
    getProjectUsageSummary(projectId),
  ]);

  const activeKeys = keys.filter((k) => !k.revokedAt);

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href={`/${orgSlug}`} className="hover:text-foreground">{orgSlug}</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{projectSlug}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.description && <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${orgSlug}/${projectSlug}/settings`}>Settings</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {project.storageType && <Badge variant="secondary" className="flex items-center gap-1"><Database className="h-3 w-3" />{project.storageType}</Badge>}
        {project.ipfsProvider && <Badge variant="secondary" className="flex items-center gap-1"><Link2 className="h-3 w-3" />{project.ipfsProvider}</Badge>}
        {project.chainId && <Badge variant="secondary" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />chain:{project.chainId}</Badge>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Activity className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wider">API Calls (30d)</span></div><p className="text-2xl font-bold">{usage.totalCalls.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><CheckCircle className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wider">Success Rate</span></div><p className="text-2xl font-bold">{usage.successRate.toFixed(1)}%</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Key className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wider">Active Keys</span></div><p className="text-2xl font-bold">{activeKeys.length}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" />API Keys</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link href={`/${orgSlug}/${projectSlug}/api-keys`}>Manage →</Link></Button>
            </div>
            <CardDescription>{activeKeys.length} active {activeKeys.length === 1 ? "key" : "keys"}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {activeKeys.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No API keys yet</p>
                <Button size="sm" asChild><Link href={`/${orgSlug}/${projectSlug}/api-keys/new`}><Plus className="h-3.5 w-3.5 mr-1" />Create key</Link></Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {activeKeys.slice(0, 3).map((key) => (
                  <li key={String(key._id)} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{key.name}</span>
                      <span className="text-muted-foreground ml-2 font-mono text-xs">{key.prefix}…</span>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{key.permissions}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><GitBranch className="h-4 w-4" />Provenance</CardTitle>
            <CardDescription>Explore resources and attribution graphs</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild><Link href={`/${orgSlug}/${projectSlug}/resources`}><Database className="h-4 w-4 mr-2" />Browse Resources</Link></Button>
            <Button variant="outline" className="w-full justify-start" asChild><Link href={`/${orgSlug}/${projectSlug}/provenance`}><GitBranch className="h-4 w-4 mr-2" />Provenance Graph</Link></Button>
            <Button variant="outline" className="w-full justify-start" asChild><Link href={`/${orgSlug}/${projectSlug}/analytics`}><BarChart3 className="h-4 w-4 mr-2" />Analytics</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
