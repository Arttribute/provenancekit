import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug, getProjectApiKeys } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Key } from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { RevokeKeyButton } from "@/components/api-keys/revoke-key-button";

interface Props { params: Promise<{ orgSlug: string; projectSlug: string }> }

export const metadata: Metadata = { title: "API Keys" };

export default async function ApiKeysPage({ params }: Props) {
  const { orgSlug, projectSlug } = await params;
  const user = await getServerUser();
  if (!user) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, user.privyDid);
  if (!orgData) notFound();

  const project = await getProjectBySlug(orgSlug, projectSlug, user.privyDid);
  if (!project) notFound();

  const keys = await getProjectApiKeys(project.id, user.privyDid);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage access keys for the ProvenanceKit API</p>
        </div>
        <Button asChild>
          <Link href={`/${orgSlug}/${projectSlug}/api-keys/new`}>
            <Plus className="h-4 w-4 mr-2" />Create key
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{keys.length} {keys.length === 1 ? "key" : "keys"}</CardTitle>
          <CardDescription>
            API keys are used to authenticate requests to the ProvenanceKit API. Each key is shown once — store it securely.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {keys.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Key className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No API keys yet. Create one to start using the API.</p>
              <Button asChild>
                <Link href={`/${orgSlug}/${projectSlug}/api-keys/new`}>
                  <Plus className="h-4 w-4 mr-2" />Create your first key
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {keys.map((key) => (
                <div key={key.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{key.name}</span>
                      {key.revokedAt && <Badge variant="destructive" className="text-xs">Revoked</Badge>}
                      {key.expiresAt && !key.revokedAt && new Date(key.expiresAt) < new Date() && (
                        <Badge variant="outline" className="text-xs">Expired</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <code className="font-mono">{key.prefix}••••••••</code>
                      <Badge variant="outline" className="capitalize">{key.permissions}</Badge>
                      <span>Created {formatDate(key.createdAt)}</span>
                      {key.lastUsedAt && <span>Last used {formatRelativeTime(key.lastUsedAt)}</span>}
                      {key.expiresAt && <span>Expires {formatDate(key.expiresAt)}</span>}
                    </div>
                  </div>
                  {!key.revokedAt && <RevokeKeyButton keyId={key.id} keyName={key.name} />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1.5">
        <p className="font-medium">Using your API key</p>
        <p className="text-muted-foreground">Include your key in the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Authorization</code> header:</p>
        <code className="block bg-muted rounded-md p-2.5 font-mono text-xs mt-2">Authorization: Bearer pk_live_••••••••</code>
      </div>
    </div>
  );
}
