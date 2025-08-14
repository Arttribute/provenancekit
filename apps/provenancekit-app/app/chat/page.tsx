// app/chat/page.tsx
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResultList } from "@/components/provenance/results-list";
import { ChatInput } from "@/components/chat/chat-input";
import { authFetch, jsonFetch } from "@/lib/fetcher";
import AssintantMessage from "@/components/chat/assistant-message";
import { useRouter } from "next/navigation";

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [outputCids, setOutputCids] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSend(message: string, attachments: File[]) {
    setErr(null);
    setLoading(true);
    try {
      // Build request body (attachments are handled in server route if needed;
      // here we just send text messages for simplicity)
      setMessages((m) => [...m, { role: "user", content: message }]);
      const response = await authFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          messages: [
            ...(sessionId ? [] : []), // nothing special
            { role: "system", content: "You are helpful." },
            { role: "user", content: message },
          ],
        }),
      });

      const res = await response.json();

      setSessionId(res.sessionId);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.completion.choices[0].message.content,
        },
      ]);
      setOutputCids(res.finalOutputCids);

      router.replace(`/chat/${res.sessionId}`);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div className="space-y-4 p-4  h-[400px] overflow-y-auto">
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

      <ChatInput onSendMessage={onSend} />

      {err && (
        <div className="text-red-500 text-sm border rounded p-3">{err}</div>
      )}

      <ResultList cids={outputCids} />
    </main>
  );
}
