import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgBySlug, getUserOrgs } from "@/lib/queries";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";

interface Props {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: Props) {
  const { orgSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [orgData, orgs] = await Promise.all([
    getOrgBySlug(orgSlug, session.user.id),
    getUserOrgs(session.user.id),
  ]);

  if (!orgData) notFound();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar orgSlug={orgSlug} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav orgs={orgs} currentOrgSlug={orgSlug} />
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
