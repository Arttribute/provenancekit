import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getOrgBySlug, getOrgProjects } from "@/lib/queries";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Plus, Settings, Users, Database, Link2 } from "lucide-react";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgSlug } = await params;
  return { title: orgSlug };
}

export default async function OrgPage({ params }: Props) {
  const { orgSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, session.user.id);
  if (!orgData) notFound();

  const projects = await getOrgProjects(orgData.org.id);

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      {/* Org header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {orgData.org.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">@{orgSlug}</p>
            <Badge variant="secondary" className="capitalize">
              {orgData.org.plan}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {orgData.role}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${orgSlug}/settings`}>
              <Settings className="h-4 w-4 mr-1.5" />
              Settings
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/${orgSlug}/projects/new`}>
              <Plus className="h-4 w-4 mr-1.5" />
              New project
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<FolderKanban className="h-4 w-4" />}
          label="Projects"
          value={projects.length}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Members"
          value="—"
        />
        <StatCard
          icon={<Database className="h-4 w-4" />}
          label="Plan"
          value={orgData.org.plan}
        />
      </div>

      {/* Projects */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Projects
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${orgSlug}/projects/new`}>
              <Plus className="h-3 w-3 mr-1" /> New
            </Link>
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed space-y-3">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No projects yet</p>
              <p className="text-sm text-muted-foreground">
                Create a project to start tracking provenance
              </p>
            </div>
            <Button asChild>
              <Link href={`/${orgSlug}/projects/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Create project
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                      <FolderKanban className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">
                        {project.name}
                      </CardTitle>
                      <CardDescription className="text-xs truncate">
                        {project.description ?? `${orgSlug}/${project.slug}`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {project.storageType && (
                        <Badge variant="outline" className="text-xs">
                          {project.storageType}
                        </Badge>
                      )}
                      {project.chainId && (
                        <Badge variant="outline" className="text-xs">
                          chain:{project.chainId}
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${orgSlug}/${project.slug}`}>Open →</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
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
  value: string | number;
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
