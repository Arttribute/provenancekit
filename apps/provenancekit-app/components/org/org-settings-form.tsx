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
import type { Organization } from "@/lib/db/schema";

const schema = z.object({
  name: z.string().min(2).max(64),
});

type FormData = z.infer<typeof schema>;

export function OrgSettingsForm({
  org,
  role,
}: {
  org: Organization;
  role: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const canEdit = ["owner", "admin"].includes(role);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: org.name },
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const res = await fetch(`/api/orgs/${org.slug}`, {
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
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                disabled={!canEdit}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={org.slug} disabled className="font-mono" />
              <p className="text-xs text-muted-foreground">
                Slugs cannot be changed after creation
              </p>
            </div>
          </CardContent>
        </Card>

        {serverError && (
          <p className="text-sm text-destructive mt-4">{serverError}</p>
        )}

        {canEdit && (
          <div className="flex justify-end mt-4">
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {saved ? "Saved!" : isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </form>

      {/* Danger zone */}
      {role === "owner" && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions — proceed with caution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
              <div>
                <p className="text-sm font-medium">Delete organization</p>
                <p className="text-xs text-muted-foreground">
                  Permanently delete {org.name} and all its projects
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  confirm(
                    `Type "${org.name}" to confirm deletion`
                  )
                }
              >
                Delete org
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
