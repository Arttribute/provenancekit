import { Suspense } from "react";
import { BundlePreviewClient } from "./client";

export default function BundlePage() {
  return (
    <Suspense>
      <BundlePreviewClient />
    </Suspense>
  );
}
