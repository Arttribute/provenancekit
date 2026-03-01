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

export interface ProvenanceKitConfig {
  _id: string;
  userId: string;
  apiKey: string;   // encrypted in production
  apiUrl: string;
  projectId?: string;
  enabled: boolean;
  createdAt: Date;
}

export type AIProvider = "openai" | "anthropic" | "google" | "custom";

export interface Conversation {
  _id: string;
  title: string;
  userId: string;
  /** The AI provider used for this conversation */
  provider: AIProvider;
  /** The specific model ID, e.g. "gpt-4o", "claude-opus-4-6", "gemini-2.0-flash" */
  model: string;
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
  /** CID of the provenance session record for this conversation */
  provenanceCid?: string;
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
  /** ProvenanceKit action ID for this AI generation */
  actionId?: string;
  /** CID of the provenance record for this message */
  provenanceCid?: string;
  /** The provider used for this message */
  provider?: AIProvider;
  /** The model used for this message */
  model?: string;
  /** Token usage (for AI responses) */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason?: string;
  createdAt: Date;
}
