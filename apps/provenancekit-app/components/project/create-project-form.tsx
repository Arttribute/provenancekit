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
import { slugify } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(64),
  slug: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  description: z.string().max(256).optional(),
  storageType: z.enum(["memory", "postgres", "mongodb", "supabase"]).default("memory"),
});

type FormData = z.infer<typeof schema>;

export function CreateProjectForm({
  orgId,
  orgSlug,
}: {
  orgId: string;
  orgSlug: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { storageType: "memory" },
  });

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue("name", e.target.value);
    setValue("slug", slugify(e.target.value));
  }

  async function onSubmit(data: FormData) {
    setServerError(null);
    const res = await fetch(`/api/orgs/${orgSlug}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, orgId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Something went wrong");
      return;
    }
    const project = await res.json();
    router.push(`/${orgSlug}/${project.slug}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              placeholder="My AI App"
              {...register("name")}
              onChange={handleNameChange}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <div className="flex items-center gap-0">
              <span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
                {orgSlug}/
              </span>
              <Input
                id="slug"
                className="rounded-l-none"
                placeholder="my-ai-app"
                {...register("slug")}
              />
            </div>
            {errors.slug && (
              <p className="text-xs text-destructive">{errors.slug.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="Provenance tracking for my chat app"
              {...register("description")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="storageType">Storage backend</Label>
            <select
              id="storageType"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("storageType")}
            >
              <option value="memory">In-memory (development only)</option>
              <option value="postgres">PostgreSQL</option>
              <option value="mongodb">MongoDB</option>
              <option value="supabase">Supabase</option>
            </select>
            <p className="text-xs text-muted-foreground">
              You can change this later in project settings
            </p>
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
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
