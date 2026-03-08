import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getUserOrgs } from "@/lib/queries";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug?: string }>;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const [orgs, { orgSlug }] = await Promise.all([
    getUserOrgs(user.privyDid),
    params,
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav orgs={orgs} currentOrgSlug={orgSlug} />
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
