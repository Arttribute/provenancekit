/**
 * OpenAI SDK singleton.
 * Used for DALL-E image generation, TTS, and STT.
 * The streaming chat itself uses @ai-sdk/openai via Vercel AI SDK.
 */

import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}
