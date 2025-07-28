// packages/provenancekit-openai/src/wrapper.ts
import OpenAI, { type ClientOptions as OpenAIClientOptions } from "openai";
import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type {
  Images,
  ImageGenerateParams,
  ImageEditParams,
  ImageCreateVariationParams,
} from "openai/resources/images";
import type { TranscriptionCreateParams } from "openai/resources/audio/transcriptions";
import type { SpeechCreateParams } from "openai/resources/audio/speech";

import {
  ProvenanceKit,
  type FileOpts,
  type FileResult,
  type DuplicateDetails,
  type ApiClientOptions as ProvClientOptions,
} from "@provenancekit/sdk";

import { base64ToBytes, fetchBytes, utf8 } from "./utils.js";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ProvInit = { client: ProvenanceKit } | ProvClientOptions;

type ImageProv = Awaited<ReturnType<Images["generate"]>> & {
  provenance: Array<FileResult | { duplicate: DuplicateDetails }>;
};

export type ToolRunner = (name: string, args: any) => Promise<unknown>;

export interface ChatProvReturn {
  completion: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
  actions: Array<{
    actionId: string;
    type: string;
    toolUsedCid?: string | null;
  }>;
  finalOutputCids: string[];
}

interface SessionOpts {
  sessionId?: string;
  linkPreviousOutputs?: boolean; // default true
  humanEntityId?: string;
  aiEntityId?: string;
  toolEntityId?: string;
}

/* ------------------------------------------------------------------ */

export class OpenAIWithProvenance {
  readonly openai: OpenAI;
  readonly pk: ProvenanceKit;
  private _toolCache = new Map<string, string>(); // key -> toolCid

  constructor(openaiOpts: OpenAIClientOptions, provenance: ProvInit = {}) {
    this.openai = new OpenAI(openaiOpts);
    this.pk =
      "client" in provenance
        ? provenance.client
        : new ProvenanceKit(provenance);
  }

  /* ───────────────────────── helpers ─────────────────────────── */

  private async recordSessionMsg(
    sessionId: string | undefined,
    entityId: string | undefined,
    payload: any
  ) {
    if (!sessionId) return;
    await this.pk.addSessionMessage(sessionId, payload, entityId);
  }

  private async ensureToolResource(
    name: string,
    spec: unknown,
    baseProv: Partial<FileOpts>,
    sessionId?: string
  ): Promise<string> {
    const key = `${name}:${JSON.stringify(spec)}`;
    const cached = this._toolCache.get(key);
    if (cached) return cached;

    const res = await this.pk.file(utf8(JSON.stringify(spec)), {
      ...baseProv,
      resourceType: "tool",
      entity: {
        role: "organization",
        name,
        ...baseProv.entity,
      },
      action: {
        type: "tool.definition",
        ...baseProv.action,
      },

      sessionId,
    });

    this._toolCache.set(key, res.cid);
    return res.cid;
  }

  private async storeTextOutput(
    text: string,
    actionType: string,
    inputCids: string[],
    toolCid: string | undefined,
    baseProv: Partial<FileOpts>,
    sessionId: string | undefined,
    entityId: string | undefined,
    entityRoleFallback: "ai" | "tool" = "ai",
    entityName?: string,
    extensions?: Record<string, any>
  ): Promise<FileResult> {
    return this.pk.file(utf8(text), {
      ...baseProv,
      resourceType: "text",
      entity: {
        id: entityId,
        role: baseProv.entity?.role ?? entityRoleFallback,
        name: entityName ?? baseProv.entity?.name ?? "openai",
        ...baseProv.entity,
      },
      action: {
        type: actionType,
        inputCids,
        toolCid,
        extensions,
        ...baseProv.action,
      },

      sessionId,
    });
  }

  private async storeBinaryOutput(
    bytes: Uint8Array,
    kind: "image" | "audio" | "video",
    actionType: string,
    inputCids: string[],
    toolCid: string | undefined,
    baseProv: Partial<FileOpts>,
    sessionId: string | undefined,
    entityId: string | undefined,
    entityName?: string,
    extensions?: Record<string, any>
  ): Promise<FileResult> {
    return this.pk.file(bytes, {
      ...baseProv,
      resourceType: kind,
      entity: {
        id: entityId,
        role: baseProv.entity?.role ?? "ai",
        name: entityName ?? baseProv.entity?.name ?? "openai",
        ...baseProv.entity,
      },
      action: {
        type: actionType,
        inputCids,
        toolCid,
        extensions,
        ...baseProv.action,
      },

      sessionId,
    });
  }

  /* ================================================================ */
  /* CHAT                                                             */
  /* ================================================================ */

  async chatWithProvenance(
    params: ChatCompletionCreateParams,
    runTool: ToolRunner,
    baseProv: Partial<FileOpts> = {},
    sessionOpts: SessionOpts = {}
  ): Promise<ChatProvReturn> {
    const {
      sessionId,
      linkPreviousOutputs = true,
      humanEntityId,
      aiEntityId,
      toolEntityId,
    } = sessionOpts;

    // Persist raw messages into session log ONLY (no prompt resources)
    if (sessionId) {
      for (const m of params.messages) {
        const eid =
          m.role === "user"
            ? humanEntityId
            : m.role === "assistant"
            ? aiEntityId
            : m.role === "tool"
            ? toolEntityId
            : undefined;

        await this.recordSessionMsg(sessionId, eid, m);
      }
    }

    const recordedInputCids: string[] = [];
    const actions: ChatProvReturn["actions"] = [];

    let messages: ChatCompletionMessageParam[] = [...params.messages];
    let lastCompletion:
      | Awaited<ReturnType<typeof this.openai.chat.completions.create>>
      | undefined;
    let loops = 0;

    while (true) {
      loops++;
      if (loops > 20) throw new Error("Too many tool loops");

      lastCompletion = await this.openai.chat.completions.create({
        ...params,
        messages,
        stream: false,
      });

      const comp =
        lastCompletion as import("openai/resources/chat/completions").ChatCompletion;
      const msg = comp.choices[0].message;

      // no tools => final answer
      if (!msg.tool_calls?.length) {
        const outRes = await this.storeTextOutput(
          msg.content ?? "",
          "openai.chat.final",
          recordedInputCids,
          undefined,
          baseProv,
          sessionId,
          aiEntityId,
          "ai",
          params.model ?? "openai",
          { messages_meta: { count: params.messages.length } }
        );

        actions.push({
          actionId: outRes.actionId ?? "",
          type: "openai.chat.final",
          toolUsedCid: null,
        });

        // also log assistant msg into session
        await this.recordSessionMsg(sessionId, aiEntityId, msg);

        return {
          completion: lastCompletion,
          actions,
          finalOutputCids: [outRes.cid],
        };
      }

      // There are tool calls
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        const argsStr = tc.function.arguments ?? "{}";

        const toolSchema = params.tools?.find(
          (t) => t.type === "function" && t.function?.name === toolName
        );
        if (!toolSchema) throw new Error(`Unknown tool: ${toolName}`);

        // record assistant message containing tool_calls
        await this.recordSessionMsg(sessionId, aiEntityId, msg);

        const toolCid = await this.ensureToolResource(
          toolName,
          toolSchema,
          baseProv,
          sessionId
        );

        let argsObj: any;
        try {
          argsObj = JSON.parse(argsStr);
        } catch {
          argsObj = { raw: argsStr };
        }

        // execute tool
        const result = await runTool(toolName, argsObj);
        const resultStr =
          typeof result === "string" ? result : JSON.stringify(result);

        // store tool result as resource
        const resultRes = await this.storeTextOutput(
          resultStr,
          "tool.exec",
          linkPreviousOutputs ? recordedInputCids : [],
          toolCid,
          baseProv,
          sessionId,
          toolEntityId,
          "tool",
          toolName,
          { args: argsObj }
        );

        actions.push({
          actionId: resultRes.actionId ?? "",
          type: "tool.exec",
          toolUsedCid: toolCid,
        });

        // push tool result back to model
        messages.push(msg); // original assistant w/ tool_calls
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: resultStr,
        });

        // log tool message into session
        await this.recordSessionMsg(sessionId, toolEntityId, {
          role: "tool",
          tool_call_id: tc.id,
          content: resultStr,
        });

        if (linkPreviousOutputs) recordedInputCids.push(resultRes.cid);
      }
    }
  }

  /* ================================================================ */
  /* IMAGES                                                           */
  /* ================================================================ */

  async generateImageWithProvenance(
    params: ImageGenerateParams,
    prov: Partial<FileOpts> = {},
    sessionOpts: SessionOpts = {}
  ): Promise<ImageProv> {
    const { sessionId, humanEntityId, aiEntityId } = sessionOpts;

    // Log prompt only
    await this.recordSessionMsg(sessionId, humanEntityId, {
      kind: "image.generate.prompt",
      prompt: params.prompt,
      model: params.model,
    });

    const toolCid = await this.ensureToolResource(
      params.model ?? "image-gen",
      { kind: "image.generate", model: params.model },
      prov,
      sessionId
    );

    const out = await this.openai.images.generate(params);

    const provResults: (FileResult | { duplicate: DuplicateDetails })[] = [];
    for (const d of out.data ?? []) {
      const bytes =
        "b64_json" in d && d.b64_json
          ? base64ToBytes(d.b64_json)
          : "url" in d && d.url
          ? await fetchBytes(d.url)
          : undefined;

      if (!bytes) continue;

      const imageRes = await this.storeBinaryOutput(
        bytes,
        "image",
        "openai.image.output",
        [],
        toolCid,
        prov,
        sessionId,
        aiEntityId,
        params.model ?? "openai",
        { prompt: params.prompt }
      );

      provResults.push(imageRes);
    }

    return { ...out, provenance: provResults };
  }

  async editImageWithProvenance(
    params: ImageEditParams,
    prov: Partial<FileOpts> = {},
    sessionOpts: SessionOpts = {}
  ): Promise<ImageProv> {
    const { sessionId, humanEntityId, aiEntityId } = sessionOpts;

    await this.recordSessionMsg(sessionId, humanEntityId, {
      kind: "image.edit.prompt",
      prompt: params.prompt ?? "",
      model: params.model,
    });

    const toolCid = await this.ensureToolResource(
      params.model ?? "image-edit",
      { kind: "image.edit", model: params.model },
      prov,
      sessionId
    );

    const out = await this.openai.images.edit(params);
    const provResults: (FileResult | { duplicate: DuplicateDetails })[] = [];

    for (const d of out.data ?? []) {
      const bytes =
        "b64_json" in d && d.b64_json
          ? base64ToBytes(d.b64_json)
          : "url" in d && d.url
          ? await fetchBytes(d.url)
          : undefined;

      if (!bytes) continue;

      const imageRes = await this.storeBinaryOutput(
        bytes,
        "image",
        "openai.image.output",
        [],
        toolCid,
        prov,
        sessionId,
        aiEntityId,
        params.model ?? "openai",
        { prompt: params.prompt ?? "" }
      );

      provResults.push(imageRes);
    }

    return { ...out, provenance: provResults };
  }

  async createImageVariationWithProvenance(
    params: ImageCreateVariationParams,
    prov: Partial<FileOpts> = {},
    sessionOpts: SessionOpts = {}
  ): Promise<ImageProv> {
    const { sessionId, humanEntityId, aiEntityId } = sessionOpts;

    await this.recordSessionMsg(sessionId, humanEntityId, {
      kind: "image.variation.request",
      model: params.model,
    });

    const toolCid = await this.ensureToolResource(
      params.model ?? "image-var",
      { kind: "image.variation", model: params.model },
      prov,
      sessionId
    );

    const out = await this.openai.images.createVariation(params);
    const provResults: (FileResult | { duplicate: DuplicateDetails })[] = [];

    for (const d of out.data ?? []) {
      const bytes =
        "b64_json" in d && d.b64_json
          ? base64ToBytes(d.b64_json)
          : "url" in d && d.url
          ? await fetchBytes(d.url)
          : undefined;

      if (!bytes) continue;

      const imageRes = await this.storeBinaryOutput(
        bytes,
        "image",
        "openai.image.output",
        [],
        toolCid,
        prov,
        sessionId,
        aiEntityId,
        params.model ?? "openai",
        { note: "variation" }
      );

      provResults.push(imageRes);
    }

    return { ...out, provenance: provResults };
  }

  /* ================================================================ */
  /* AUDIO                                                            */
  /* ================================================================ */

  async ttsWithProvenance(
    params: SpeechCreateParams,
    prov: Partial<FileOpts> = {},
    sessionOpts: SessionOpts = {}
  ) {
    const { sessionId, humanEntityId, aiEntityId } = sessionOpts;

    await this.recordSessionMsg(sessionId, humanEntityId, {
      kind: "tts.prompt",
      input: params.input,
      model: params.model,
    });

    const toolCid = await this.ensureToolResource(
      params.model ?? "tts",
      { kind: "audio.tts", model: params.model },
      prov,
      sessionId
    );

    /* ---------- fetch + clone (new) ---------- */
    const rsp = await this.openai.audio.speech.create(params);
    const bytes = new Uint8Array(await rsp.clone().arrayBuffer()); // ← clone!

    const audioRes = await this.storeBinaryOutput(
      bytes,
      "audio",
      "openai.tts.output",
      [],
      toolCid,
      prov,
      sessionId,
      aiEntityId,
      params.model ?? "openai",
      { input: params.input, voice: (params as any).voice }
    );

    return { response: rsp, provenance: audioRes }; // rsp body is still readable
  }

  async sttWithProvenance(
    params: TranscriptionCreateParams,
    prov: Partial<FileOpts> = {},
    sessionOpts: SessionOpts = {}
  ) {
    const { sessionId, humanEntityId, aiEntityId } = sessionOpts;

    await this.recordSessionMsg(sessionId, humanEntityId, {
      kind: "stt.upload",
      fileName: (params.file as any)?.name,
      model: params.model,
    });

    const toolCid = await this.ensureToolResource(
      params.model ?? "whisper",
      { kind: "audio.stt", model: params.model },
      prov,
      sessionId
    );

    const rsp = await this.openai.audio.transcriptions.create({
      ...params,
      stream: false,
    });

    const textRes = await this.storeTextOutput(
      rsp.text,
      "openai.stt.output",
      [],
      toolCid,
      prov,
      sessionId,
      aiEntityId,
      "ai",
      params.model ?? "openai",
      { language: (params as any).language ?? "auto" }
    );

    return { ...rsp, provenance: textRes };
  }
}
