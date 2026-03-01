import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Info } from "lucide-react";

interface Props {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}

export const metadata: Metadata = { title: "Resources" };

export default async function ResourcesPage({ params }: Props) {
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
        <h1 className="text-2xl font-bold tracking-tight">Resources</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Browse and search all provenance-tracked resources in this project
        </p>
      </div>

      {/* Info: connects to PK API */}
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <p className="font-medium">Resources are stored in your configured storage backend</p>
          <p className="text-muted-foreground mt-0.5">
            Configure your storage (PostgreSQL, MongoDB, Supabase) and IPFS provider in{" "}
            <a
              href={`/${orgSlug}/${projectSlug}/settings`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              project settings
            </a>
            , then use the ProvenanceKit API or SDK to record resources.
          </p>
        </div>
      </div>

      {/* Stats placeholder */}
      <div className="grid gap-4 sm:grid-cols-3">
        {["Images", "Text", "Audio/Video"].map((type) => (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Database className="h-3.5 w-3.5" />
                {type}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-bold">—</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resource list placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 space-y-2">
            <Database className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">No resources recorded yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Use the ProvenanceKit SDK or API to start recording resources in
              your application.
            </p>
            <div className="pt-2">
              <Badge variant="outline">
                GET /v1/resources — list resources
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
