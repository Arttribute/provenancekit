import { getDb } from "@/lib/mongodb";
import { CidDetailClient } from "@/components/provenance/cid-detail-client";
import type { ChatMessage, Conversation } from "@/types";

type Props = { params: Promise<{ cid: string }> };

/**
 * Server Component — fetches sessionId from MongoDB before rendering.
 *
 * Strategy:
 *   1. Look up the ChatMessage with provenance.cid === cid
 *   2. Get the conversation from the message's conversationId
 *   3. Read conversation.provenance.sessionId
 *   4. Pass to <CidDetailClient> for client-side rendering
 */
export default async function ProvenanceCidPage({ params }: Props) {
  const { cid } = await params;
  let sessionId: string | null = null;

  try {
    const db = await getDb();
    const message = await db
      .collection<ChatMessage>("messages")
      .findOne({ "provenance.cid": cid });

    if (message?.conversationId) {
      const conversation = await db
        .collection<Conversation>("conversations")
        .findOne({ _id: message.conversationId });
      sessionId = conversation?.provenance?.sessionId ?? null;
    }
  } catch {
    // Non-fatal — we just won't show the session tab
  }

  return <CidDetailClient cid={cid} sessionId={sessionId} />;
}
