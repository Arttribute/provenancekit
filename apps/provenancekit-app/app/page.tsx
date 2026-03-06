import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { LandingSignInButton } from "@/components/auth/landing-sign-in-button";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Shield, Zap, Database, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function RootPage() {
  const user = await getServerUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <span className="text-primary-foreground font-bold text-xs">PK</span>
          </div>
          <span className="font-semibold text-sm">ProvenanceKit</span>
        </div>
        <LandingSignInButton />
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center space-y-8 max-w-3xl mx-auto w-full">
        <div className="space-y-4">
          <Badge variant="outline" className="text-xs font-mono">
            Universal Provenance Framework
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Provenance for{" "}
            <span className="text-primary">Human-AI</span>{" "}
            created works
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Track attribution, record actions, and verify creative lineage
            across your entire AI-assisted workflow — on-chain or off.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <LandingSignInButton />
          <Link
            href="https://docs.provenancekit.com"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Read the docs
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Feature grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 w-full pt-8">
          {[
            {
              icon: <GitBranch className="h-5 w-5 text-blue-500" />,
              title: "Provenance graphs",
              body: "Trace every action and entity across the full creative lineage",
            },
            {
              icon: <Zap className="h-5 w-5 text-yellow-500" />,
              title: "On-chain recording",
              body: "Immutable EAA records anchored to any EVM-compatible chain",
            },
            {
              icon: <Shield className="h-5 w-5 text-green-500" />,
              title: "Privacy extensions",
              body: "Selective disclosure, TEE attestation, and AI training opt-out",
            },
            {
              icon: <Database className="h-5 w-5 text-purple-500" />,
              title: "Pluggable storage",
              body: "MongoDB, IPFS, or in-memory — swap without changing your code",
            },
          ].map(({ icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border bg-muted/30 p-4 text-left space-y-2"
            >
              {icon}
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>© 2026 ProvenanceKit</span>
        <div className="flex gap-4">
          <a href="https://docs.provenancekit.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Docs</a>
          <a href="https://github.com/provenancekit" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
          <a href="https://provenancekit.com/privacy" className="hover:text-foreground transition-colors">Privacy</a>
        </div>
      </footer>
    </div>
  );
}
