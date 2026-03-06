import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug } from "@/lib/queries";
import { ProjectSettingsForm } from "@/components/settings/project-settings-form";

interface Props { params: Promise<{ orgSlug: string; projectSlug: string }> }

export const metadata: Metadata = { title: "Project Settings" };

export default async function ProjectSettingsPage({ params }: Props) {
  const { orgSlug, projectSlug } = await params;
  const user = await getServerUser();
  if (!user) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, user.privyDid);
  if (!orgData) notFound();

  const project = await getProjectBySlug(orgSlug, projectSlug, user.privyDid);
  if (!project) notFound();

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Project Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure storage, IPFS, and blockchain for {project.name}
        </p>
      </div>
      <ProjectSettingsForm project={project} />
    </div>
  );
}
