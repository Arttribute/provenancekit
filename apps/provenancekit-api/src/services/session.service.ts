/**
 * Session Service
 *
 * Platform-level session management using Supabase.
 * Sessions group related activities for context tracking.
 */

import { v4 as uuidv4 } from "uuid";
import { getContext } from "../context.js";
import { ProvenanceKitError } from "../errors.js";

/*─────────────────────────────────────────────────────────────*\
 | Types                                                         |
\*─────────────────────────────────────────────────────────────*/

export interface Session {
  id: string;
  title?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  endedAt?: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  entityId?: string;
  content: unknown;
  createdAt: string;
}

/*─────────────────────────────────────────────────────────────*\
 | Session Operations                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create a new session.
 */
export async function createSession(
  title?: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const { supabase } = getContext();

  const id = uuidv4();
  const { error } = await supabase.from("pk_session").insert({
    id,
    title: title ?? null,
    metadata: metadata ?? null,
  });

  if (error) {
    throw new ProvenanceKitError("Internal", `Failed to create session: ${error.message}`);
  }

  return id;
}

/**
 * Close a session.
 */
export async function closeSession(id: string): Promise<void> {
  const { supabase } = getContext();

  const { error } = await supabase
    .from("pk_session")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new ProvenanceKitError("Internal", `Failed to close session: ${error.message}`);
  }
}

/**
 * Assert that a session is open.
 */
export async function assertSessionOpen(id: string): Promise<void> {
  const { supabase } = getContext();

  const { data, error } = await supabase
    .from("pk_session")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new ProvenanceKitError("NotFound", "Session not found");
  }

  if (data.ended_at) {
    throw new ProvenanceKitError("Unsupported", "Session is closed", {
      recovery: "Create a new session",
      details: { sessionId: id },
    });
  }
}

/**
 * Add a message to a session.
 */
export async function addSessionMessage(opts: {
  sessionId: string;
  entityId?: string;
  content: unknown;
}): Promise<string> {
  await assertSessionOpen(opts.sessionId);

  const { supabase } = getContext();
  const id = uuidv4();

  const { error } = await supabase.from("pk_session_message").insert({
    id,
    session_id: opts.sessionId,
    entity_id: opts.entityId ?? null,
    content: opts.content,
  });

  if (error) {
    throw new ProvenanceKitError("Internal", `Failed to add message: ${error.message}`);
  }

  console.log(`Added message ${id} to session ${opts.sessionId}`);
  return id;
}

/**
 * Get session details with messages and related resources.
 */
export async function getSession(id: string): Promise<{
  session: Session;
  messages: SessionMessage[];
}> {
  const { supabase } = getContext();

  // Get session
  const { data: sessionData, error: sessionError } = await supabase
    .from("pk_session")
    .select("*")
    .eq("id", id)
    .single();

  if (sessionError || !sessionData) {
    throw new ProvenanceKitError("NotFound", "Session not found");
  }

  // Get messages
  const { data: messagesData } = await supabase
    .from("pk_session_message")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const session: Session = {
    id: sessionData.id,
    title: sessionData.title ?? undefined,
    metadata: sessionData.metadata ?? undefined,
    createdAt: sessionData.created_at,
    endedAt: sessionData.ended_at ?? undefined,
  };

  interface MessageRow {
    id: string;
    session_id: string;
    entity_id: string | null;
    content: unknown;
    created_at: string;
  }

  const messages: SessionMessage[] = ((messagesData ?? []) as MessageRow[]).map((m) => ({
    id: m.id,
    sessionId: m.session_id,
    entityId: m.entity_id ?? undefined,
    content: m.content,
    createdAt: m.created_at,
  }));

  return { session, messages };
}
