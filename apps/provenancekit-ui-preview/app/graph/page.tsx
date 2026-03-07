import { Suspense } from "react";
import { GraphPreviewClient } from "./client";

export default function GraphPage() {
  return (
    <Suspense>
      <GraphPreviewClient />
    </Suspense>
  );
}
