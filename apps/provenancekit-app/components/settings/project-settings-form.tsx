"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MgmtProject } from "@/lib/management-client";

const schema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional().nullable(),
  // Advisory label — only meaningful when self-hosting provenancekit-api.
  // Does not change how the hosted api.provenancekit.org stores your provenance records.
  storageType: z
    .enum(["memory", "postgres", "mongodb", "supabase", "ipfs", "custom"])
    .default("supabase"),
  // Per-project IPFS — actively used: the ProvenanceKit API routes your file uploads
  // to this provider/account instead of the platform defaults.
  ipfsProvider: z.enum(["pinata", "infura", "web3storage", "arweave", "local"]).default("pinata"),
  ipfsApiKey: z.string().optional().nullable(),
  ipfsGateway: z.string().url().optional().nullable().or(z.literal("")),
  // Self-hosted API endpoint. Leave blank to use the hosted api.provenancekit.org.
  apiUrl: z.string().url().optional().nullable().or(z.literal("")),
  // On-chain config
  chainId: z.coerce.number().int().positive().optional().nullable(),
  contractAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid EVM address")
    .optional()
    .nullable()
    .or(z.literal("")),
  rpcUrl: z.string().url().optional().nullable().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

export function ProjectSettingsForm({ project }: { project: MgmtProject }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project.name,
      description: project.description,
      storageType: (project.storageType as FormData["storageType"]) ?? "supabase",
      ipfsProvider: (project.ipfsProvider as FormData["ipfsProvider"]) ?? "pinata",
      ipfsApiKey: project.ipfsApiKey,
      ipfsGateway: project.ipfsGateway,
      apiUrl: project.apiUrl,
      chainId: project.chainId,
      contractAddress: project.contractAddress,
      rpcUrl: project.rpcUrl,
    },
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Something went wrong");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="What is this project for?"
              {...register("description")}
            />
          </div>
        </CardContent>
      </Card>

      {/* IPFS / File Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">IPFS / File Storage</CardTitle>
          <CardDescription>
            When you upload files via the ProvenanceKit API, they are pinned to IPFS.
            Set your own provider credentials here to pin to your account — leaving
            these blank uses the platform&apos;s default Pinata account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ipfsProvider">Provider</Label>
            <select
              id="ipfsProvider"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("ipfsProvider")}
            >
              <option value="pinata">Pinata</option>
              <option value="infura">Infura</option>
              <option value="web3storage">Web3.Storage</option>
              <option value="arweave">Arweave</option>
              <option value="local">Local node</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ipfsApiKey">API key / JWT</Label>
            <Input
              id="ipfsApiKey"
              type="password"
              placeholder="Leave blank to use platform default"
              {...register("ipfsApiKey")}
            />
            <p className="text-xs text-muted-foreground">
              When set, all file uploads for this project pin to your own account.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ipfsGateway">Gateway URL</Label>
            <Input
              id="ipfsGateway"
              placeholder="https://gateway.pinata.cloud/ipfs"
              {...register("ipfsGateway")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Self-hosted API */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Self-hosted API</CardTitle>
          <CardDescription>
            Leave blank to use the hosted ProvenanceKit API at api.provenancekit.org.
            If you are running your own provenancekit-api instance, set its URL here —
            the SDK will point at it for all provenance operations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="apiUrl">API URL</Label>
            <Input
              id="apiUrl"
              placeholder="https://your-api.example.com"
              {...register("apiUrl")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="storageType">Provenance record storage</Label>
            <select
              id="storageType"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("storageType")}
            >
              <option value="supabase">Supabase / PostgreSQL</option>
              <option value="postgres">PostgreSQL (direct)</option>
              <option value="mongodb">MongoDB</option>
              <option value="memory">In-memory (development only)</option>
              <option value="custom">Custom</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Advisory — documents which storage adapter your self-hosted API uses.
              Configure the actual adapter via your server&apos;s environment variables.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Blockchain */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Blockchain</CardTitle>
          <CardDescription>
            Optional. Enables on-chain provenance anchoring via the ProvenanceRegistry
            contract. Records are cryptographically tamper-evident and verifiable
            independently of this API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="chainId">Chain ID</Label>
              <Input
                id="chainId"
                type="number"
                placeholder="84532 (Base Sepolia)"
                {...register("chainId")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rpcUrl">RPC URL</Label>
              <Input
                id="rpcUrl"
                placeholder="https://sepolia.base.org"
                {...register("rpcUrl")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contractAddress">ProvenanceRegistry contract address</Label>
            <Input
              id="contractAddress"
              placeholder="0x…"
              className="font-mono"
              {...register("contractAddress")}
            />
            {errors.contractAddress && (
              <p className="text-xs text-destructive">
                {errors.contractAddress.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {serverError && (
        <p className="text-sm text-destructive">{serverError}</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {saved ? "Saved!" : isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
