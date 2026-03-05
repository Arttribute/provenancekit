import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <div className="space-y-8">
      {/* Logo + heading */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
          <span className="text-primary-foreground font-bold text-xl">PK</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Sign in to ProvenanceKit
        </h1>
        <p className="text-sm text-muted-foreground">
          Universal provenance for Human-AI created works
        </p>
      </div>

      <LoginForm />

      <p className="text-center text-xs text-muted-foreground">
        By signing in, you agree to our{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
