import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug } from "@/lib/queries";
import { CreateApiKeyForm } from "@/components/api-keys/create-api-key-form";

interface Props {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}

export const metadata: Metadata = { title: "New API Key" };

export default async function NewApiKeyPage({ params }: Props) {
  const { orgSlug, projectSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, session.user.id);
  if (!orgData) notFound();

  const project = await getProjectBySlug(orgData.org.id, projectSlug);
  if (!project) notFound();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create API Key</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The secret key is shown only once. Store it securely.
        </p>
      </div>
      <CreateApiKeyForm
        projectId={project.id}
        orgSlug={orgSlug}
        projectSlug={projectSlug}
      />
    </div>
  );
}
