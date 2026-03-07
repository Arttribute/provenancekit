import { Suspense } from "react";
import { SearchPreviewClient } from "./client";

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPreviewClient />
    </Suspense>
  );
}
