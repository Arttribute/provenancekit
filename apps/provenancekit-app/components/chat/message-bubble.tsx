"use client";

import AIMessage from "./assistant-message";

export default function MessageBubble({
  msg,
  streaming = false,
}: {
  msg: { role: "user" | "assistant"; content: string; metadata?: any };
  streaming?: boolean;
}) {
  if (msg.role === "assistant")
    return (
      <div className="max-w-prose">
        <AIMessage
          content={msg.content}
          metadata={msg.metadata}
          isStreaming={streaming}
        />
      </div>
    );

  /* user bubble */
  return (
    <div className="self-end bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-prose text-sm whitespace-pre-wrap">
      {msg.content}
    </div>
  );
}
