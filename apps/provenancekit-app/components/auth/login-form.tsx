"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Github } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function handleOAuth(provider: string) {
    setLoading(provider);
    await signIn(provider, { callbackUrl: "/dashboard" });
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading("email");
    await signIn("resend", { email, callbackUrl: "/dashboard", redirect: false });
    setEmailSent(true);
    setLoading(null);
  }

  if (emailSent) {
    return (
      <div className="text-center space-y-3 p-6 rounded-xl border bg-card">
        <div className="text-2xl">✉️</div>
        <h2 className="font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a magic link to <strong>{email}</strong>. Click the link to
          sign in.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setEmailSent(false)}>
          Try a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* OAuth buttons */}
      <div className="space-y-2">
        <Button
          className="w-full"
          variant="outline"
          onClick={() => handleOAuth("github")}
          disabled={loading !== null}
        >
          <Github className="mr-2 h-4 w-4" />
          {loading === "github" ? "Connecting…" : "Continue with GitHub"}
        </Button>
        <Button
          className="w-full"
          variant="outline"
          onClick={() => handleOAuth("google")}
          disabled={loading !== null}
        >
          {/* Google icon as SVG */}
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {loading === "google" ? "Connecting…" : "Continue with Google"}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      {/* Magic link */}
      <form onSubmit={handleEmail} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading !== null}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading !== null || !email}
        >
          {loading === "email" ? "Sending…" : "Continue with Email"}
        </Button>
      </form>
    </div>
  );
}
