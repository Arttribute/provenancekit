import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getOrgBySlug } from "@/lib/queries";
import { OrgSettingsForm } from "@/components/org/org-settings-form";

interface Props { params: Promise<{ orgSlug: string }> }

export const metadata: Metadata = { title: "Organization Settings" };

export default async function OrgSettingsPage({ params }: Props) {
  const { orgSlug } = await params;
  const user = await getServerUser();
  if (!user) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, user.privyDid);
  if (!orgData) notFound();

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage settings for {orgData.org.name}</p>
      </div>
      <OrgSettingsForm org={orgData.org} role={orgData.role as string} />
    </div>
  );
}
