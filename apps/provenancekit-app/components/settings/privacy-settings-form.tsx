"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Eye, EyeOff, Lock, Cpu, Info, CheckCircle } from "lucide-react";
import type { MgmtProject } from "@/lib/management-client";

interface Props {
  project: MgmtProject;
}

export function PrivacySettingsForm({ project }: Props) {
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    // Backed by the database — persisted via management API
    aiTrainingOptOut: project.aiTrainingOptOut ?? false,
    // UI-only advisory settings (rendered for awareness; not yet persisted server-side)
    selectiveDisclosure: false,
    anonymizeEntities: false,
    teeEnabled: false,
    teeProvider: "none",
    dataRetentionDays: "90",
  });

  function handleToggle(key: keyof typeof settings) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
    setServerError(null);
  }

  function handleSelect(key: keyof typeof settings, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setServerError(null);
  }

  async function handleSave() {
    setSaving(true);
    setServerError(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiTrainingOptOut: settings.aiTrainingOptOut }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Something went wrong");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6">
      {/* AI Training & Consent — persisted */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            AI Training Opt-Out
          </CardTitle>
          <CardDescription>
            Automatically attach{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">
              ext:license@1.0.0 / hasAITrainingReservation: true
            </code>{" "}
            to every resource uploaded via this project&apos;s API key.
            This signals that the content may not be used for AI model training
            without explicit permission, consistent with EU AI Act Art.&nbsp;53(1)(c)
            and the DSM Directive Art.&nbsp;4(3).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ai-optout-toggle">AI training opt-out</Label>
              <p className="text-xs text-muted-foreground">
                Applied automatically to all resources — no per-upload configuration needed
              </p>
            </div>
            <Switch
              id="ai-optout-toggle"
              checked={settings.aiTrainingOptOut}
              onCheckedChange={() => handleToggle("aiTrainingOptOut")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Selective Disclosure — advisory */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Selective Disclosure
          </CardTitle>
          <CardDescription>
            Allow contributors to reveal only specific provenance fields using Pedersen commitments
            and SD-JWT-like presentations. Powered by{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">@provenancekit/privacy</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="disclosure-toggle">Enable selective disclosure</Label>
              <p className="text-xs text-muted-foreground">
                Contributors can share partial proofs without revealing all attribution details
              </p>
            </div>
            <Switch
              id="disclosure-toggle"
              checked={settings.selectiveDisclosure}
              onCheckedChange={() => handleToggle("selectiveDisclosure")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="anon-toggle">Anonymize entity identifiers</Label>
              <p className="text-xs text-muted-foreground">
                Replace entity IDs with pseudonyms in public provenance records (GDPR Art.&nbsp;25)
              </p>
            </div>
            <Switch
              id="anon-toggle"
              checked={settings.anonymizeEntities}
              onCheckedChange={() => handleToggle("anonymizeEntities")}
            />
          </div>
        </CardContent>
      </Card>

      {/* TEE — advisory */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Trusted Execution Environment (TEE)
          </CardTitle>
          <CardDescription>
            Run provenance computation inside a hardware-attested enclave. The attestation quote is
            stored alongside the provenance record and verifiable on-chain without revealing raw inputs.
            Requires a self-hosted provenancekit-api deployment with TEE support.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="tee-toggle">Enable TEE attestation</Label>
              <p className="text-xs text-muted-foreground">
                Adds a hardware attestation proof to every provenance record
              </p>
            </div>
            <Switch
              id="tee-toggle"
              checked={settings.teeEnabled}
              onCheckedChange={() => handleToggle("teeEnabled")}
            />
          </div>

          {settings.teeEnabled && (
            <div className="space-y-2 pl-1">
              <Label className="text-xs font-medium">TEE Provider</Label>
              <Select
                value={settings.teeProvider}
                onValueChange={(v) => handleSelect("teeProvider", v)}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intel-tdx">Intel TDX</SelectItem>
                  <SelectItem value="amd-sev">AMD SEV-SNP</SelectItem>
                  <SelectItem value="aws-nitro">AWS Nitro Enclaves</SelectItem>
                  <SelectItem value="azure-cvm">Azure Confidential VMs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Retention — advisory */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <EyeOff className="h-4 w-4" />
            Data Retention
          </CardTitle>
          <CardDescription>
            How long provenance records are retained in hot storage before archival.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select
              value={settings.dataRetentionDays}
              onValueChange={(v) => handleSelect("dataRetentionDays", v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
                <SelectItem value="forever">Forever</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Records older than this are moved to cold archival storage
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="text-muted-foreground space-y-0.5">
          <p>
            The <strong>AI training opt-out</strong> setting is persisted in the database and
            applied automatically by the ProvenanceKit API. All other settings are advisory
            and require additional setup in your deployment.
          </p>
          <p>
            See the{" "}
            <a
              href="https://docs.provenancekit.org/guides/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              privacy guide
            </a>{" "}
            for selective disclosure and TEE setup instructions.
          </p>
        </div>
      </div>

      {serverError && (
        <p className="text-sm text-destructive">{serverError}</p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || saved}>
          {saved ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Saved
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              {saving ? "Saving…" : "Save privacy settings"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
