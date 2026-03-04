import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug, getUserOrgs } from "@/lib/queries";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";

interface Props {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}

export default async function ProjectLayout({ children, params }: Props) {
  const { orgSlug, projectSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [orgData, orgs] = await Promise.all([
    getOrgBySlug(orgSlug, session.user.id),
    getUserOrgs(session.user.id),
  ]);
  if (!orgData) notFound();

  const project = await getProjectBySlug(orgData.org.id, projectSlug);
  if (!project) notFound();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar orgSlug={orgSlug} projectSlug={projectSlug} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav orgs={orgs} currentOrgSlug={orgSlug} />
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
