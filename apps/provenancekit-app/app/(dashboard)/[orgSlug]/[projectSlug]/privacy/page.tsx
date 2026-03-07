import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug } from "@/lib/queries";
import { PrivacySettingsForm } from "@/components/settings/privacy-settings-form";

interface Props { params: Promise<{ orgSlug: string; projectSlug: string }> }

export const metadata: Metadata = { title: "Privacy Settings" };

export default async function PrivacyPage({ params }: Props) {
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
        <h1 className="text-2xl font-bold tracking-tight">Privacy Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure data handling, selective disclosure, and AI training preferences for {project.name}
        </p>
      </div>
      <PrivacySettingsForm project={project} />
    </div>
  );
}
