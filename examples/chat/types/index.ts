/**
 * MongoDB document types for the chat example app.
 * These are separate from ProvenanceKit's EAA types — they represent
 * the application state, not the provenance records.
 */

export interface ChatUser {
  _id: string;
  privyDid: string;
  email?: string;
  name?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AIProvider = "openai" | "anthropic" | "google" | "custom";

export interface ModelInfo {
  provider: AIProvider;
  model: string;
  displayName: string;
  contextWindow?: string;
  description?: string;
}

export interface UserSettings {
  _id: string;
  userId: string; // privyDid
  defaultProvider: AIProvider;
  defaultModel: string;
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  _id: string;
  title: string;
  userId: string;
  /** The AI provider used for this conversation */
  provider: AIProvider;
  /** The specific model ID, e.g. "gpt-4o", "claude-opus-4-6", "gemini-2.0-flash" */
  model: string;
  systemPrompt?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  /** CID of the last AI response in this conversation */
  provenanceCid?: string;
  /** ProvenanceKit session tracking fields */
  provenance?: {
    sessionId: string; // UUID generated at conversation creation; passed to pk.file() as sessionId
    firstCid?: string;
    lastCid?: string;
    totalMessages: number;
  };
}

export interface MessagePart {
  type: "text" | "image_url" | "file";
  text?: string;
  url?: string;
  mimeType?: string;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  contentParts?: MessagePart[];
  /** The provider used for this message (assistant only) */
  provider?: AIProvider;
  /** The model used for this message (assistant only) */
  model?: string;
  /** Token usage (for AI responses) */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason?: string;
  createdAt: Date;
  /** ProvenanceKit provenance data (assistant messages only) */
  provenance?: {
    cid: string; // response resource CID (primary identifier)
    actionId?: string; // PK action ID for the generate action
    promptCid?: string; // CID of the corresponding user prompt resource
    sessionId?: string; // mirrors conversation.provenance.sessionId
  };
}
