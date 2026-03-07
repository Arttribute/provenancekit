import { Suspense } from "react";
import { BadgePreviewClient } from "./client";

export default function BadgePage() {
  return (
    <Suspense>
      <BadgePreviewClient />
    </Suspense>
  );
}
