"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function PreviewShell({
  children,
  className = "p-8",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const params = useSearchParams();
  const dark = params.get("dark") === "1";

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return (
    <div
      className={className}
      style={{ background: "var(--pk-surface)", minHeight: "100vh" }}
    >
      {children}
    </div>
  );
}
