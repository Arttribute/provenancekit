"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  Cpu,
  Info,
  CheckCircle,
} from "lucide-react";

export default function PrivacyPage() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    teeEnabled: false,
    teeProvider: "none",
    selectiveDisclosure: false,
    aiTrainingOptOut: true,
    anonymizeEntities: false,
    redactMetadata: false,
    consentRequired: false,
    dataRetentionDays: "90",
  });

  function handleToggle(key: keyof typeof settings) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function handleSelect(key: keyof typeof settings, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    // In a real implementation this would call PATCH /api/projects/:id
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Privacy Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure data handling, TEE attestation, and selective disclosure for this project
          </p>
        </div>
        <Button onClick={handleSave} size="sm" disabled={saved}>
          {saved ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Saved
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>

      {/* TEE / Attestation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Trusted Execution Environment (TEE)
          </CardTitle>
          <CardDescription>
            Run provenance computation inside a hardware-attested enclave. Proofs are verifiable
            on-chain without revealing raw inputs.
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
                  <SelectItem value="none">No attestation</SelectItem>
                  <SelectItem value="intel-tdx">Intel TDX</SelectItem>
                  <SelectItem value="amd-sev">AMD SEV-SNP</SelectItem>
                  <SelectItem value="aws-nitro">AWS Nitro Enclaves</SelectItem>
                  <SelectItem value="azure-cvm">Azure Confidential VMs</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Attestation quotes will be stored alongside provenance records.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selective Disclosure */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Selective Disclosure
          </CardTitle>
          <CardDescription>
            Allow entities to reveal only specific provenance fields using zero-knowledge proofs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="disclosure-toggle">Enable selective disclosure</Label>
              <p className="text-xs text-muted-foreground">
                Uses Pedersen commitments so contributors can share partial proofs
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
                Replace entity IDs with pseudonyms in public records
              </p>
            </div>
            <Switch
              id="anon-toggle"
              checked={settings.anonymizeEntities}
              onCheckedChange={() => handleToggle("anonymizeEntities")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="redact-toggle">Redact metadata fields</Label>
              <p className="text-xs text-muted-foreground">
                Strip free-text fields (descriptions, labels) before public storage
              </p>
            </div>
            <Switch
              id="redact-toggle"
              checked={settings.redactMetadata}
              onCheckedChange={() => handleToggle("redactMetadata")}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Training & Consent */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            AI Training & Consent
          </CardTitle>
          <CardDescription>
            Control whether provenance data may be used for AI model training and whether
            explicit consent must be recorded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ai-optout-toggle">AI training opt-out</Label>
              <p className="text-xs text-muted-foreground">
                Records{" "}
                <code className="font-mono text-[11px] bg-muted px-1 rounded">
                  ext:license@1.0.0 / hasAITrainingReservation: true
                </code>{" "}
                on every resource
              </p>
            </div>
            <Switch
              id="ai-optout-toggle"
              checked={settings.aiTrainingOptOut}
              onCheckedChange={() => handleToggle("aiTrainingOptOut")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="consent-toggle">Require explicit consent</Label>
              <p className="text-xs text-muted-foreground">
                API calls must include a valid consent token before recording provenance
              </p>
            </div>
            <Switch
              id="consent-toggle"
              checked={settings.consentRequired}
              onCheckedChange={() => handleToggle("consentRequired")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Retention */}
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
            Privacy extensions are powered by{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">@provenancekit/privacy</code>.
          </p>
          <p>
            TEE attestation and selective disclosure require additional setup in your deployment.
            See the{" "}
            <span className="underline underline-offset-4 cursor-pointer hover:text-foreground">
              privacy docs
            </span>{" "}
            for details.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saved}>
          {saved ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Saved
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Save privacy settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
