"use client";

import { ReactNode } from "react";
import useSWR from "swr";
import { authFetch } from "@/lib/fetcher";
import { SessionsSideBar } from "@/components/chat/sessions-side-bar";

export default function ChatLayout({ children }: { children: ReactNode }) {
  /* ------------------------------------------------------------------ */
  /*  Load the current user’s sessions                                  */
  /* ------------------------------------------------------------------ */
  //   const { data, error, isLoading } = useSWR("/api/sessions", async (url) => {
  //     const res = await authFetch(url);
  //     return res.json(); // { sessions: [...] }
  //   });

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <div className="flex h-screen">
      {/* {isLoading && <p className="text-xs text-muted-foreground">…loading</p>}
      {error && (
        <p className="text-xs text-red-500">
          Failed to load sessions: {String(error)}
        </p>
      )} */}

      <SessionsSideBar username={"test"} sessions={[]} />

      <section className="w-full">{children}</section>
    </div>
  );
}
