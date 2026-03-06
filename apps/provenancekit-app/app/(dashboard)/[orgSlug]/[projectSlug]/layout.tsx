import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug } from "@/lib/queries";

interface Props {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}

export default async function ProjectLayout({ children, params }: Props) {
  const { orgSlug, projectSlug } = await params;
  const user = await getServerUser();
  if (!user) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, user.privyDid);
  if (!orgData) notFound();

  const project = await getProjectBySlug(orgSlug, projectSlug, user.privyDid);
  if (!project) notFound();

  return <>{children}</>;
}
