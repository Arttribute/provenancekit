import { Suspense } from "react";
import { TrackerPreviewClient } from "./client";

export default function TrackerPage() {
  return (
    <Suspense>
      <TrackerPreviewClient />
    </Suspense>
  );
}
