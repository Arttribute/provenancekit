import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CreateOrgForm } from "@/components/org/create-org-form";

export const metadata: Metadata = { title: "New Organization" };

export default async function NewOrgPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create Organization</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Organizations are shared workspaces for your team. Each org can have
          multiple projects.
        </p>
      </div>
      <CreateOrgForm userId={session.user.id} />
    </div>
  );
}
