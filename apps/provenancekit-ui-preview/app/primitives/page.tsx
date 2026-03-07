import { Suspense } from "react";
import { PrimitivesPreviewClient } from "./client";

export default function PrimitivesPage() {
  return (
    <Suspense>
      <PrimitivesPreviewClient />
    </Suspense>
  );
}
