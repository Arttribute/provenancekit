/**
 * Application types for the PK Chat example.
 * These are separate from ProvenanceKit's EAA types — they represent
 * application state, not provenance records.
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
  userId: string;
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
  provider: AIProvider;
  model: string;
  systemPrompt?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  provenanceCid?: string;
  provenance?: {
    sessionId: string;
    firstCid?: string;
    lastCid?: string;
    totalMessages: number;
  };
}

/** A part of a multi-modal message */
export interface MessagePart {
  type: "text" | "image_url" | "file" | "audio";
  text?: string;
  url?: string;
  mimeType?: string;
  name?: string;
}

/** A tool call made/returned in an assistant message */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
}

/** A file attachment queued by the user before sending */
export interface FileAttachment {
  /** Original browser File object — kept for provenance search */
  file?: File;
  /** Pinata/IPFS gateway URL (preferred) or base64 data URL fallback */
  url?: string;
  /** IPFS CID — set when uploaded to Pinata; used for provenance inputCids */
  cid?: string;
  mimeType: string;
  name: string;
  /** Extracted text content for text/* files — included inline for the LLM */
  textContent?: string;
  /** For images: width x height (optional display hint) */
  width?: number;
  height?: number;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  /** Plain text content (always set; may be empty string for tool messages) */
  content: string;
  /** Structured content parts (for multi-modal user messages) */
  contentParts?: MessagePart[];
  /** Generated image URL from DALL-E tool */
  imageUrl?: string;
  imageRevisedPrompt?: string;
  /** Generated audio data URI from TTS tool */
  audioUrl?: string;
  audioText?: string;
  /** Tool calls made by the assistant */
  toolCalls?: ToolCall[];
  /** For role="tool" messages */
  toolCallId?: string;
  toolName?: string;
  provider?: AIProvider;
  model?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason?: string;
  /** "recording" while async provenance write is in-flight; "recorded" on success; "failed" on error */
  provenanceStatus?: "recording" | "recorded" | "failed";
  createdAt: Date;
  provenance?: {
    cid: string;
    actionId?: string;
    promptCid?: string;
    sessionId?: string;
  };
  /** Separate provenance record for a DALL-E generated image in this message */
  imageProvenance?: {
    cid: string;
    actionId?: string;
    status: "recording" | "recorded" | "failed";
  };
}
