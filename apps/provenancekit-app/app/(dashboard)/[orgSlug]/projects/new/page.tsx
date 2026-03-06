import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getOrgBySlug } from "@/lib/queries";
import { CreateProjectForm } from "@/components/project/create-project-form";

interface Props { params: Promise<{ orgSlug: string }> }

export const metadata: Metadata = { title: "New Project" };

export default async function NewProjectPage({ params }: Props) {
  const { orgSlug } = await params;
  const user = await getServerUser();
  if (!user) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, user.privyDid);
  if (!orgData) notFound();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create Project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A project is a provenance namespace with its own API keys, storage, and blockchain config.
        </p>
      </div>
      <CreateProjectForm orgId={orgData.org.id} orgSlug={orgSlug} />
    </div>
  );
}
