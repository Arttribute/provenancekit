// app/chat/page.tsx
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResultList } from "@/components/provenance/results-list";
import { ChatInput } from "@/components/chat/chat-input";
import { authFetch, jsonFetch } from "@/lib/fetcher";

export default function ChatPage() {
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
        { role: "user", content: message },
        {
          role: "assistant",
          content: res.completion.choices[0].message.content,
        },
      ]);
      setOutputCids(res.finalOutputCids);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Chat (Provenance Enabled)</h1>

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4 border rounded p-4 bg-gray-50 max-h-[400px] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className="text-sm whitespace-pre-wrap">
                <span className="font-semibold mr-2">{m.role}:</span>
                {m.content}
              </div>
            ))}
            {loading && <div className="text-xs text-gray-500">…</div>}
          </div>

          <ChatInput onSendMessage={onSend} />

          {err && (
            <div className="text-red-500 text-sm border rounded p-3">{err}</div>
          )}

          <ResultList cids={outputCids} />
        </CardContent>
      </Card>
    </main>
  );
}
