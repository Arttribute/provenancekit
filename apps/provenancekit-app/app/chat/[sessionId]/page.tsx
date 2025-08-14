/* app/chat/[sessionId]/page.tsx */
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatInput } from "@/components/chat/chat-input";
import AssintantMessage from "@/components/chat/assistant-message";
import { ResultList } from "@/components/provenance/results-list";
import { authFetchJSON } from "@/lib/fetcher";
import { ScrollArea } from "@/components/ui/scroll-area";

type Msg = { role: "user" | "assistant"; content: string };

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [outputCids, setOutputCids] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* ---------------- Fetch existing session history on mount -------------- */
  const fetchedOnce = useRef(false);
  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;

    (async () => {
      try {
        const data = await authFetchJSON<{ data: { messages?: any[] } }>(
          `/api/sessions/session?sessionId=${sessionId}`
        );
        console.log("Fetched session data:", data);

        setMessages(
          data.data.messages
            ?.map((msg: any) => ({
              role: msg.content.role,
              content: msg.content.content,
            }))
            ?.filter((msg) => msg.role !== "system") ?? []
        );
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, [sessionId]);

  /* ---------------- Send a new chat turn --------------------------------- */
  async function onSend(message: string, attachments: File[]) {
    setErr(null);
    setLoading(true);

    try {
      // upload‑inspect flow already happened inside ChatInput;
      // it handed us the resolved CIDs of matching resources
      const inputCids = attachments
        .filter((a: any) => a.cid) // only resources that exist/ were matched
        .map((a: any) => a.cid as string);

      setMessages((m) => [...m, { role: "user", content: message }]);
      const res = await authFetchJSON<{
        completion: any;
        finalOutputCids: string[];
      }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          messages: [
            { role: "system", content: "You are helpful." },
            { role: "user", content: message },
          ],
          inputCids,
        }),
      });

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.completion.choices[0].message.content,
        },
      ]);
      setOutputCids(res.finalOutputCids ?? []);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- Fetch list of *all* sessions for sidebar ------------- */
  const [sessions, setSessions] = useState<Array<any>>([]);
  useEffect(() => {
    (async () => {
      try {
        const { sessions } = await authFetchJSON<{ sessions: any[] }>(
          "/api/sessions"
        );
        setSessions(sessions);
      } catch (e) {
        console.warn("Could not load sessions", e);
      }
    })();
  }, []);

  /* ---------------------------------------------------------------------- */
  return (
    <main className="">
      <section className="flex-1 flex flex-col">
        <ScrollArea
          className="overflow-y-auto"
          scrollHideDelay={100}
          style={{ height: "94vh" }}
        >
          <div className="px-6 py-8 max-w-4xl mx-auto space-y-6 mb-40">
            {messages.map((m, i) => (
              <div key={i} className="text-sm whitespace-pre-wrap">
                {m.role === "assistant" ? (
                  <AssintantMessage content={m.content} />
                ) : (
                  <div className="flex rounded-xl justify-end">
                    <div className={`rounded-xl bg-indigo-100 my-4 ml-4  p-2`}>
                      {m.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading && <div className="text-xs text-gray-500">…</div>}
          </div>
        </ScrollArea>
        <div className="container mx-auto max-w-4xl">
          <div className="fixed bottom-4 z-50 min-w-4xl">
            <ChatInput onSendMessage={onSend} />
          </div>
        </div>

        <ResultList cids={outputCids} />
      </section>
    </main>
  );
}
