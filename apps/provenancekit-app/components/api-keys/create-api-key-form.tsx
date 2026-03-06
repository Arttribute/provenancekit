"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Copy, Check } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(64),
  permissions: z.enum(["read", "write", "admin"]),
  expiresInDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .nullable(),
});

type FormData = z.infer<typeof schema>;

interface CreatedKey {
  key: string;
  prefix: string;
  name: string;
}

export function CreateApiKeyForm({
  projectId,
  orgSlug,
  projectSlug,
}: {
  projectId: string;
  orgSlug: string;
  projectSlug: string;
}) {
  const router = useRouter();
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [neverExpires, setNeverExpires] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { permissions: "read" },
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const payload = {
      ...data,
      expiresInDays: neverExpires ? null : (data.expiresInDays ?? null),
    };
    const res = await fetch(`/api/projects/${projectId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Something went wrong");
      return;
    }
    const result = await res.json();
    setCreatedKey({ key: result.key, prefix: result.prefix, name: data.name });
  }

  async function copyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (createdKey) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <p className="font-semibold text-green-800 dark:text-green-400">
              API key created — save it now!
            </p>
          </div>
          <p className="text-sm text-green-700 dark:text-green-500">
            This is the only time your secret key will be shown. Copy and store
            it somewhere safe.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white dark:bg-black/20 border rounded-md px-3 py-2 font-mono text-sm break-all">
              {createdKey.key}
            </code>
            <Button variant="outline" size="icon" onClick={copyKey}>
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <Button
          onClick={() =>
            router.push(`/${orgSlug}/${projectSlug}/api-keys`)
          }
        >
          Done — go to API keys
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Key name</Label>
            <Input
              id="name"
              placeholder="Production, Dev, CI, …"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="flex gap-2 flex-wrap">
              {(["read", "write", "admin"] as const).map((perm) => (
                <label
                  key={perm}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    value={perm}
                    className="sr-only"
                    {...register("permissions")}
                  />
                  <div className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5 cursor-pointer">
                    <input
                      type="radio"
                      value={perm}
                      className="h-3.5 w-3.5"
                      {...register("permissions")}
                    />
                    <span className="capitalize">{perm}</span>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>read</strong> — query provenance data •{" "}
              <strong>write</strong> — record actions & resources •{" "}
              <strong>admin</strong> — full access including key management
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Expiry</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Never expires</span>
                <Switch
                  checked={neverExpires}
                  onCheckedChange={setNeverExpires}
                />
              </div>
            </div>
            {!neverExpires && (
              <div className="flex items-center gap-2">
                <Input
                  id="expires"
                  type="number"
                  min={1}
                  max={365}
                  placeholder="90"
                  className="max-w-[120px]"
                  {...register("expiresInDays")}
                />
                <span className="text-sm text-muted-foreground">days (leave blank for no expiry)</span>
              </div>
            )}
            {neverExpires && (
              <p className="text-xs text-muted-foreground">
                This key will never expire. Rotate it manually if compromised.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {serverError && (
        <p className="text-sm text-destructive">{serverError}</p>
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${orgSlug}/${projectSlug}/api-keys`)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create key"}
        </Button>
      </div>
    </form>
  );
}
