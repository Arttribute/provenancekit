import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getOrgBySlug, getOrgMembers } from "@/lib/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Props { params: Promise<{ orgSlug: string }> }

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ params }: Props) {
  const { orgSlug } = await params;
  const user = await getServerUser();
  if (!user) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, user.privyDid);
  if (!orgData) notFound();

  const members = await getOrgMembers(orgSlug, user.privyDid);

  const roleColors: Record<string, "default" | "secondary" | "outline"> = {
    owner: "default",
    admin: "secondary",
    developer: "outline",
    viewer: "outline",
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} member{members.length !== 1 ? "s" : ""} in {orgData.org.name}
          </p>
        </div>
        {["owner", "admin"].includes(orgData.role) && (
          <Button size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite member
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team members
          </CardTitle>
          <CardDescription>
            Manage who has access to {orgData.org.name} and their roles
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {member.userId.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium font-mono">{member.userId.slice(0, 20)}…</p>
                    <p className="text-xs text-muted-foreground">Joined {formatDate(member.joinedAt)}</p>
                  </div>
                </div>
                <Badge variant={roleColors[member.role] ?? "outline"} className="capitalize">
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
        <p className="font-medium">Role permissions</p>
        <div className="grid gap-1.5 text-muted-foreground text-xs">
          <div><strong className="text-foreground">Owner</strong> — Full access, billing, delete org</div>
          <div><strong className="text-foreground">Admin</strong> — Manage members, projects, settings</div>
          <div><strong className="text-foreground">Developer</strong> — Create projects, manage API keys</div>
          <div><strong className="text-foreground">Viewer</strong> — Read-only access</div>
        </div>
      </div>
    </div>
  );
}
