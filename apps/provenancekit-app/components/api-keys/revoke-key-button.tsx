"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function RevokeKeyButton({
  keyId,
  keyName,
}: {
  keyId: string;
  keyName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function revoke() {
    if (!confirm(`Revoke key "${keyName}"? This cannot be undone.`)) return;
    setLoading(true);
    await fetch(`/api/api-keys/${keyId}/revoke`, { method: "POST" });
    router.refresh();
    setLoading(false);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-destructive"
      onClick={revoke}
      disabled={loading}
    >
      <Trash2 className="h-4 w-4" />
      <span className="sr-only">Revoke</span>
    </Button>
  );
}
