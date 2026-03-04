"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Wallet,
  Link2,
  CheckCircle,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  privyDid: string;
  initialName: string;
  initialEmail: string;
  initialAvatar: string;
}

export function UserSettingsForm({ privyDid, initialName, initialEmail, initialAvatar }: Props) {
  const { user: privyUser, logout, linkEmail, linkGoogle, linkGithub, linkWallet } = usePrivy();
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveError(d.error ?? "Failed to save");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    await logout();
    router.replace("/login");
  }

  // Derive linked accounts
  const linkedEmail = privyUser?.email?.address ?? initialEmail;
  const linkedGoogle = privyUser?.google?.email;
  const linkedGithub = privyUser?.github?.username;
  const linkedWallets = privyUser?.linkedAccounts?.filter((a) => a.type === "wallet") ?? [];

  return (
    <div className="p-6 space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your profile and connected accounts
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold">
              {name ? name[0].toUpperCase() : privyDid.slice(4, 6).toUpperCase()}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {privyDid.slice(0, 30)}…
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false); }}
              placeholder="Your name"
              className="max-w-sm"
            />
          </div>

          {saveError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {saveError}
            </div>
          )}

          <Button onClick={handleSave} disabled={saving || saved} size="sm">
            {saved ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                Saved
              </>
            ) : saving ? (
              "Saving…"
            ) : (
              "Save changes"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Connected accounts */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            Link additional sign-in methods to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email */}
          <AccountRow
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={linkedEmail}
            onLink={linkEmail}
          />

          {/* Google */}
          <AccountRow
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            }
            label="Google"
            value={linkedGoogle}
            onLink={linkGoogle}
          />

          {/* GitHub */}
          <AccountRow
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            }
            label="GitHub"
            value={linkedGithub ? `@${linkedGithub}` : undefined}
            onLink={linkGithub}
          />

          {/* Wallets */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Wallets</p>
                {linkedWallets.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {linkedWallets.map((w) => (
                      <Badge key={w.address} variant="outline" className="font-mono text-[10px]">
                        {w.address.slice(0, 6)}…{w.address.slice(-4)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No wallet connected</p>
                )}
              </div>
            </div>
            {linkedWallets.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => linkWallet()}>
                Connect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Sign Out
          </CardTitle>
          <CardDescription>
            Sign out of your account on this device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountRow({
  icon,
  label,
  value,
  onLink,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onLink: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          {value ? (
            <p className="text-xs text-muted-foreground">{value}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Not connected</p>
          )}
        </div>
      </div>
      {value ? (
        <Badge variant="secondary" className="text-xs">
          <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
          Connected
        </Badge>
      ) : (
        <Button variant="outline" size="sm" onClick={onLink}>
          Connect
        </Button>
      )}
    </div>
  );
}
