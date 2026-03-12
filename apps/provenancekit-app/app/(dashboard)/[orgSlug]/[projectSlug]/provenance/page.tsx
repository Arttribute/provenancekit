import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { mgmt } from "@/lib/management-client";
import { getOrgBySlug, getProjectBySlug } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GitBranch, Info, FileBox } from "lucide-react";
import { NetworkBadge } from "@/components/network-badge";
import { ProvenanceViewer } from "@/components/provenance/provenance-viewer";
import { FileSimilaritySearch } from "@/components/resources/file-similarity-search";

interface Props {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
  searchParams: Promise<{ cid?: string; depth?: string }>;
}

export const metadata: Metadata = { title: "Provenance Graph" };

export default async function ProvenancePage({ params, searchParams }: Props) {
  const { orgSlug, projectSlug } = await params;
  const { cid } = await searchParams;

  const user = await getServerUser();
  if (!user) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, user.privyDid);
  if (!orgData) notFound();

  const project = await getProjectBySlug(orgSlug, projectSlug, user.privyDid);
  if (!project) notFound();

  const apiNetwork = await mgmt(user.privyDid)
    .network.get()
    .catch(() => ({ configured: false as const }));

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Provenance Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visualize attribution chains for any resource CID
          </p>
        </div>
        {apiNetwork.configured && (
          <NetworkBadge
            chainId={apiNetwork.chainId}
            chainName={apiNetwork.chainName}
            contractAddress={apiNetwork.contractAddress}
            showExplorer
          />
        )}
      </div>

      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-muted-foreground">
          Enter a resource CID to trace its full provenance — entities, actions, inputs,
          outputs, and attribution across the entire lineage.
        </p>
      </div>

      {/* File similarity search — upload a file to find its CID */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileBox className="h-4 w-4" />
            Find by File
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <FileSimilaritySearch />
        </CardContent>
      </Card>

      {/* CID search form */}
      <form method="GET" className="flex gap-2">
        <Input
          name="cid"
          defaultValue={cid ?? ""}
          placeholder="bafy… or any resource CID"
          className="font-mono flex-1"
          autoComplete="off"
        />
        <Button type="submit">
          <GitBranch className="h-4 w-4 mr-1.5" />
          Explore
        </Button>
      </form>

      {/* Provenance viewer — uses @provenancekit/ui ProvenanceBundleView + ProvenanceGraph */}
      {cid?.trim() ? (
        <ProvenanceViewer cid={cid.trim()} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 space-y-3">
              <GitBranch className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="font-medium">Enter a CID above to explore provenance</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                The graph walks backwards through the provenance chain, showing every
                entity, action, and resource in the lineage.
              </p>
              <div className="flex justify-center gap-4 pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                  Resources
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-500 inline-block" />
                  Actions
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                  Entities
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
