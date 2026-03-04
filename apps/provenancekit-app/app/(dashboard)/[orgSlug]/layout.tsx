import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getOrgBySlug, getUserOrgs } from "@/lib/queries";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";

interface Props {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: Props) {
  const { orgSlug } = await params;
  const user = await getServerUser();
  if (!user) redirect("/login");

  const [orgData, orgs] = await Promise.all([
    getOrgBySlug(orgSlug, user.privyDid),
    getUserOrgs(user.privyDid),
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
