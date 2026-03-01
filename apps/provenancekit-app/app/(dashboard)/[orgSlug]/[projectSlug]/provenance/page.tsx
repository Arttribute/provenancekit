import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Info } from "lucide-react";

interface Props {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}

export const metadata: Metadata = { title: "Provenance Graph" };

export default async function ProvenancePage({ params }: Props) {
  const { orgSlug, projectSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, session.user.id);
  if (!orgData) notFound();

  const project = await getProjectBySlug(orgData.org.id, projectSlug);
  if (!project) notFound();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Provenance Graph</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visualize attribution chains for any resource CID
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-muted-foreground">
          Enter a resource CID to trace its full provenance graph — entities,
          actions, inputs, outputs, and attribution across the entire lineage.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-16 space-y-3">
            <GitBranch className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Graph explorer coming soon</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Interactive provenance graph visualization using the{" "}
              <code className="font-mono text-xs">
                GET /v1/resources/:cid/graph
              </code>{" "}
              endpoint.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
