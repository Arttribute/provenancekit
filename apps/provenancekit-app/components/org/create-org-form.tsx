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
  name: z.string().min(2, "Name must be at least 2 characters").max(64),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
});

type FormData = z.infer<typeof schema>;

export function CreateOrgForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Auto-fill slug from name
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue("name", e.target.value);
    setValue("slug", slugify(e.target.value));
  }

  async function onSubmit(data: FormData) {
    setServerError(null);
    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, userId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Something went wrong");
      return;
    }
    const org = await res.json();
    router.push(`/${org.slug}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Organization name</Label>
            <Input
              id="name"
              placeholder="Acme Inc."
              {...register("name")}
              onChange={handleNameChange}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">
              URL slug{" "}
              <span className="text-muted-foreground font-normal">
                (used in URLs and API)
              </span>
            </Label>
            <div className="flex items-center gap-0">
              <span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
                provenancekit.com/
              </span>
              <Input
                id="slug"
                className="rounded-l-none"
                placeholder="acme-inc"
                {...register("slug")}
              />
            </div>
            {errors.slug && (
              <p className="text-xs text-destructive">{errors.slug.message}</p>
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
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create organization"}
        </Button>
      </div>
    </form>
  );
}
