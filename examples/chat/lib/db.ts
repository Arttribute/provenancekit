/**
 * Mongoose database connection + schema definitions.
 *
 * All models use string UUIDs as _id (not ObjectId) for URL-safe IDs.
 */

import mongoose, { Schema, Model } from "mongoose";

// ─── Connection ───────────────────────────────────────────────────────────────

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/provenancekit-chat";

declare global {
  // eslint-disable-next-line no-var
  var _mongooseConnPromise: Promise<typeof mongoose> | undefined;
}

export async function connectDB(): Promise<typeof mongoose> {
  // Already fully connected — fast path
  if (mongoose.connection.readyState === 1) return mongoose;

  // Cache the connection promise on global so concurrent requests and
  // Next.js hot-reloads share a single mongoose.connect() call.
  if (!global._mongooseConnPromise) {
    global._mongooseConnPromise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .catch((err) => {
        // Allow retry on next request if connection fails
        global._mongooseConnPromise = undefined;
        throw err;
      });
  }

  return global._mongooseConnPromise;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface IUser {
  _id: string;
  privyDid: string;
  email?: string;
  name?: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  { _id: String, privyDid: { type: String, required: true, unique: true, index: true }, email: String, name: String, avatar: String },
  { timestamps: true }
);

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface IConversation {
  _id: string;
  title: string;
  userId: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  messageCount: number;
  provenanceCid?: string;
  provenance?: { sessionId: string; firstCid?: string; lastCid?: string; totalMessages: number };
  createdAt?: Date;
  updatedAt?: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    _id: String,
    title: { type: String, default: "New conversation" },
    userId: { type: String, required: true, index: true },
    provider: { type: String, default: "openai" },
    model: { type: String, default: "gpt-4o" },
    systemPrompt: String,
    messageCount: { type: Number, default: 0 },
    provenanceCid: String,
    provenance: { sessionId: String, firstCid: String, lastCid: String, totalMessages: { type: Number, default: 0 } },
  },
  { timestamps: true }
);
ConversationSchema.index({ userId: 1, updatedAt: -1 });
ConversationSchema.index({ "provenance.sessionId": 1 });

// ─── Message ──────────────────────────────────────────────────────────────────

export interface IMessageContentPart {
  type: string;
  text?: string;
  url?: string;
  mimeType?: string;
  name?: string;
}

export interface IToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
}

export interface IMessage {
  _id: string;
  conversationId: string;
  role: string;
  content: string;
  contentParts?: IMessageContentPart[];
  imageUrl?: string;
  imageRevisedPrompt?: string;
  audioUrl?: string;
  audioText?: string;
  toolCalls?: IToolCall[];
  toolCallId?: string;
  toolName?: string;
  provider?: string;
  model?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason?: string;
  provenance?: { cid: string; actionId?: string; promptCid?: string; sessionId?: string };
  createdAt?: Date;
  updatedAt?: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    _id: String,
    conversationId: { type: String, required: true, index: true },
    role: { type: String, required: true },
    content: { type: String, default: "" },
    contentParts: [Schema.Types.Mixed],
    imageUrl: String,
    imageRevisedPrompt: String,
    audioUrl: String,
    audioText: String,
    toolCalls: [Schema.Types.Mixed],
    toolCallId: String,
    toolName: String,
    provider: String,
    model: String,
    usage: { promptTokens: Number, completionTokens: Number, totalTokens: Number },
    finishReason: String,
    provenance: { cid: String, actionId: String, promptCid: String, sessionId: String },
  },
  { timestamps: true }
);
MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ "provenance.cid": 1 });

// ─── UserSettings ─────────────────────────────────────────────────────────────

export interface IUserSettings {
  _id: string;
  userId: string;
  defaultProvider: string;
  defaultModel: string;
  systemPrompt?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSettingsSchema = new Schema<IUserSettings>(
  {
    _id: String,
    userId: { type: String, required: true, unique: true, index: true },
    defaultProvider: { type: String, default: "openai" },
    defaultModel: { type: String, default: "gpt-4o" },
    systemPrompt: String,
  },
  { timestamps: true }
);

// ─── Model registry (Next.js hot-reload safe) ─────────────────────────────────

export const UserModel: Model<IUser> =
  (mongoose.models["User"] as Model<IUser>) ?? mongoose.model<IUser>("User", UserSchema);

export const ConversationModel: Model<IConversation> =
  (mongoose.models["Conversation"] as Model<IConversation>) ?? mongoose.model<IConversation>("Conversation", ConversationSchema);

export const MessageModel: Model<IMessage> =
  (mongoose.models["Message"] as Model<IMessage>) ?? mongoose.model<IMessage>("Message", MessageSchema);

export const UserSettingsModel: Model<IUserSettings> =
  (mongoose.models["UserSettings"] as Model<IUserSettings>) ?? mongoose.model<IUserSettings>("UserSettings", UserSettingsSchema);
