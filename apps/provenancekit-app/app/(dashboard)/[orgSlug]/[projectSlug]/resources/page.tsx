import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Database,
  Info,
  Zap,
  User,
  Bot,
  AlertCircle,
  FileBox,
  CheckCircle2,
} from "lucide-react";
import { pkApiFetch } from "@/lib/pk-api";

interface Props {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
  searchParams: Promise<{ cid?: string }>;
}

interface Resource {
  address?: { ref?: string; scheme?: string };
  type?: string;
  createdAt?: string;
  createdBy?: string;
}

interface Action {
  id?: string;
  type?: string;
  performedBy?: string;
  timestamp?: string;
  inputs?: Array<{ ref?: string }>;
  outputs?: Array<{ ref?: string }>;
}

interface Entity {
  id?: string;
  role?: string;
  name?: string;
  wallet?: string;
}

interface Attribution {
  entityId?: string;
  actionId?: string;
  role?: string;
  timestamp?: string;
}

interface ProvenanceBundle {
  resources: Resource[];
  actions: Action[];
  entities: Entity[];
  attributions: Attribution[];
}

interface DistributionEntry {
  entityId: string;
  share: number;
}

export const metadata: Metadata = { title: "Resources" };

function SectionTitle({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold">{children}</h3>
      <span className="text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
        {count}
      </span>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs min-w-0">
      <span className="text-muted-foreground/60 shrink-0">{label}:</span>
      <span className="truncate font-mono">{value}</span>
    </div>
  );
}

export default async function ResourcesPage({ params, searchParams }: Props) {
  const { orgSlug, projectSlug } = await params;
  const { cid } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, session.user.id);
  if (!orgData) notFound();

  const project = await getProjectBySlug(orgData.org.id, projectSlug);
  if (!project) notFound();

  let bundle: ProvenanceBundle | null = null;
  let distribution: DistributionEntry[] | null = null;
  let fetchError: string | null = null;

  if (cid?.trim()) {
    const [bundleResult, distResult] = await Promise.all([
      pkApiFetch<ProvenanceBundle>(`/v1/resources/${encodeURIComponent(cid.trim())}/bundle`),
      pkApiFetch<DistributionEntry[]>(
        `/v1/resources/${encodeURIComponent(cid.trim())}/distribution`
      ),
    ]);

    if (bundleResult.ok && bundleResult.data) {
      bundle = bundleResult.data;
    } else {
      fetchError = bundleResult.error ?? "Failed to fetch resource bundle";
    }

    if (distResult.ok && distResult.data) {
      distribution = distResult.data;
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resources</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Browse and inspect provenance-tracked resources in this project
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <p className="font-medium">Look up a resource by CID</p>
          <p className="text-muted-foreground mt-0.5">
            Use the ProvenanceKit SDK or API to record resources, then enter the CID here to
            inspect its full provenance bundle.{" "}
            <a
              href={`/${orgSlug}/${projectSlug}/settings`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Configure storage
            </a>{" "}
            in project settings.
          </p>
        </div>
      </div>

      {/* Search form */}
      <form method="GET" className="flex gap-2">
        <Input
          name="cid"
          defaultValue={cid ?? ""}
          placeholder="bafy… or any resource CID"
          className="font-mono flex-1"
          autoComplete="off"
        />
        <Button type="submit">
          <Database className="h-4 w-4 mr-1.5" />
          Lookup
        </Button>
      </form>

      {/* Error */}
      {fetchError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
          <div>
            <p className="font-medium text-destructive">Resource not found</p>
            <p className="text-muted-foreground mt-0.5">{fetchError}</p>
          </div>
        </div>
      )}

      {/* Bundle results */}
      {bundle && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2 items-center">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Resource found</span>
            <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded ml-1">{cid}</code>
          </div>

          {/* Stats row */}
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Resources", value: bundle.resources.length, color: "text-blue-700" },
              { label: "Actions", value: bundle.actions.length, color: "text-purple-700" },
              { label: "Entities", value: bundle.entities.length, color: "text-green-700" },
              { label: "Attributions", value: bundle.attributions.length, color: "text-orange-600" },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Resources */}
          {bundle.resources.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <SectionTitle count={bundle.resources.length}>Resources</SectionTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {bundle.resources.map((r, i) => (
                  <div key={i} className="rounded-md border bg-blue-50/40 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="text-xs font-medium text-blue-700">
                        {r.type ?? "unknown type"}
                      </span>
                    </div>
                    <Field label="CID" value={r.address?.ref} />
                    <Field label="created" value={r.createdAt} />
                    <Field label="by" value={r.createdBy} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {bundle.actions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <SectionTitle count={bundle.actions.length}>Actions</SectionTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {bundle.actions.map((a, i) => (
                  <div key={i} className="rounded-md border bg-purple-50/40 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      <span className="text-xs font-semibold text-purple-700 capitalize">
                        {a.type ?? "action"}
                      </span>
                    </div>
                    <Field label="id" value={a.id} />
                    <Field label="performed by" value={a.performedBy} />
                    <Field label="timestamp" value={a.timestamp} />
                    {(a.inputs?.length ?? 0) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        inputs:{" "}
                        {a.inputs!.map((inp) => (inp.ref?.slice(0, 12) ?? "?") + "…").join(", ")}
                      </div>
                    )}
                    {(a.outputs?.length ?? 0) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        outputs:{" "}
                        {a.outputs!.map((out) => (out.ref?.slice(0, 12) ?? "?") + "…").join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Entities */}
          {bundle.entities.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <SectionTitle count={bundle.entities.length}>Entities</SectionTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {bundle.entities.map((e, i) => {
                  const isAI = e.role === "ai";
                  return (
                    <div key={i} className="rounded-md border bg-green-50/40 p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        {isAI ? (
                          <Bot className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        )}
                        <span className="text-xs font-medium text-green-700">
                          {e.name ?? e.role ?? "entity"}
                        </span>
                        {e.role && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {e.role}
                          </Badge>
                        )}
                      </div>
                      <Field label="id" value={e.id} />
                      <Field label="wallet" value={e.wallet} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Attribution */}
          {bundle.attributions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <SectionTitle count={bundle.attributions.length}>Attribution</SectionTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {bundle.attributions.map((attr, i) => {
                  const entity = bundle.entities.find((e) => e.id === attr.entityId);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs rounded border bg-muted/20 px-3 py-2"
                    >
                      <span className="font-medium truncate">
                        {entity?.name ?? (attr.entityId?.slice(0, 16) + "…") ?? "Unknown"}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {attr.role && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">
                            {attr.role}
                          </Badge>
                        )}
                        {attr.timestamp && (
                          <span className="text-muted-foreground">
                            {new Date(attr.timestamp).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Revenue distribution */}
          {distribution && distribution.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Revenue Distribution</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {distribution.map((entry, i) => {
                  const entity = bundle.entities.find((e) => e.id === entry.entityId);
                  const pct = ((entry.share / 10000) * 100).toFixed(1);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">
                          {entity?.name ?? entry.entityId.slice(0, 16) + "…"}
                        </span>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!cid && !bundle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resource Inspector</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 space-y-3">
              <FileBox className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">Enter a CID above to inspect a resource</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Use the ProvenanceKit SDK or API to record resources in your application, then
                look them up here by CID to see the full provenance bundle and revenue
                distribution.
              </p>
              <div className="pt-2 flex flex-col gap-1.5 items-center">
                <Badge variant="outline" className="font-mono text-xs">
                  POST /v1/resources/upload
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  GET /v1/resources/:cid/bundle
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  GET /v1/resources/:cid/distribution
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
