import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getUserByUserId } from "@/lib/queries";
import { UserSettingsForm } from "@/components/settings/user-settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const userDoc = await getUserByUserId(user.privyDid);

  return (
    <UserSettingsForm
      privyDid={user.privyDid}
      initialName={userDoc?.name ?? ""}
      initialEmail={userDoc?.email ?? ""}
      initialAvatar={userDoc?.avatar ?? ""}
    />
  );
}
