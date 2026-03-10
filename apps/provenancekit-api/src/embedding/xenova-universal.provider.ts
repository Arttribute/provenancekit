import {
  pipeline,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  ClapAudioModelWithProjection,
} from "@xenova/transformers";

import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, unlink, mkdir, readdir, rm } from "node:fs/promises";
import ffmpeg from "fluent-ffmpeg";
import WavefileMod from "wavefile";

import type { EmbeddingProvider } from "./provider.js";

type Vec = number[];
const WaveFile = WavefileMod.WaveFile;
/* ---------- helpers ---------- */
function mimeToExt(mime: string): string {
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("quicktime") || mime.includes("mov")) return ".mov";
  if (mime.includes("x-msvideo") || mime.includes("avi")) return ".avi";
  if (mime.includes("x-matroska") || mime.includes("mkv")) return ".mkv";
  if (mime.includes("mp4")) return ".mp4";
  if (mime.includes("mp3")) return ".mp3";
  if (mime.includes("wav")) return ".wav";
  return ".bin";
}

/** data:… → {bytes, mime}  |  http(s) → {bytes, mime=""} */
async function toBytes(src: string): Promise<{ bytes: Buffer; mime: string }> {
  if (src.startsWith("data:")) {
    const mid = src.indexOf(",");
    const meta = src.slice(5, mid); // e.g. image/png;base64
    const mime = meta.split(";")[0] || "application/octet-stream";
    const buf = Buffer.from(src.slice(mid + 1), "base64");
    return { bytes: buf, mime };
  }
  // http / https
  const res = await fetch(src);
  if (!res.ok) throw new Error(`fetch ${src}: ${res.status}`);
  const mime = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = Buffer.from(await res.arrayBuffer());
  return { bytes: buf, mime };
}

/* ===================================================================== */
/*                           Provider implementation                     */
/* ===================================================================== */
export class XenovaUniversalProvider implements EmbeddingProvider {
  private readonly vision = "Xenova/clip-vit-base-patch16";

  private textCache?: { tok: any; mdl: any };
  private imgPipe?: any;

  /* CLAP for audio ----------------------------------------------- */
  private clapProcessor?: any;
  private clapModel?: any;

  /* ---------- lazy loaders ---------- */
  private async lText() {
    if (!this.textCache) {
      this.textCache = {
        tok: await AutoTokenizer.from_pretrained(this.vision),
        mdl: await CLIPTextModelWithProjection.from_pretrained(this.vision),
      };
    }
    return this.textCache;
  }
  private async lImg() {
    if (!this.imgPipe)
      this.imgPipe = await pipeline("image-feature-extraction", this.vision);
    return this.imgPipe;
  }

  private async lClap() {
    if (!this.clapProcessor) {
      this.clapProcessor = await AutoProcessor.from_pretrained(
        "Xenova/larger_clap_general"
      );
      this.clapModel = await ClapAudioModelWithProjection.from_pretrained(
        "Xenova/larger_clap_general"
      );
    }
    return { proc: this.clapProcessor, mdl: this.clapModel };
  }
  /* ---------- WARM-UP ---------- */
  /** Pre-load CLIP models so the first real request doesn't trigger a cold download. */
  async warmup(): Promise<void> {
    await Promise.all([this.lText(), this.lImg()]);
  }

  /* ---------- TEXT ---------- */
  async encodeText(text: string): Promise<Vec> {
    const { tok, mdl } = await this.lText();
    const inp = tok([text], { padding: true, truncation: true });
    const { text_embeds } = await mdl(inp, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(text_embeds.data as Float32Array);
  }

  /* ---------- IMAGE ---------- */
  async encodeImage(src: string): Promise<Vec> {
    // 1. Get bytes + mime
    const { bytes, mime } = await toBytes(src);

    // 2. Write to a temporary file
    const tmpPath = `${tmpdir()}/${randomUUID()}${mimeToExt(mime)}`;
    await writeFile(tmpPath, bytes);

    // 3. Run pipeline with *file path string* (works on all platforms)
    try {
      const out = await (
        await this.lImg()
      )(tmpPath, {
        pooling: "mean",
        normalize: true,
      });
      return Array.from(out.data as Float32Array);
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  }

  async encodeAudio(src: string): Promise<Vec> {
    const { bytes, mime } = await toBytes(src);
    const base = join(tmpdir(), randomUUID());
    const inPath = base + mimeToExt(mime);
    await writeFile(inPath, bytes);

    /* always end up with mono 48-kHz WAV for CLAP */
    const wavPath = mime.includes("wav") ? inPath : `${base}.wav`;
    if (!mime.includes("wav")) {
      await new Promise<void>((res, rej) =>
        ffmpeg(inPath)
          .audioChannels(1)
          .audioFrequency(48_000)
          .audioCodec("pcm_s16le")
          .format("wav")
          .on("end", () => res())
          .on("error", rej)
          .save(wavPath)
      );
    }

    try {
      /* decode WAV → Float32Array */
      const wav = new WaveFile(await readFile(wavPath));
      wav.toBitDepth("32f");
      wav.toSampleRate(48_000);
      const samples = wav.getSamples();
      const pcm = new Float32Array(samples as Float64Array); // mono

      /* CLAP embedding */
      const { proc, mdl } = await this.lClap();
      const inputs = await proc(pcm); // handles padding etc.
      const { audio_embeds } = await mdl(inputs, {
        pooling: "mean",
        normalize: true,
      });
      return Array.from(audio_embeds.data as Float32Array);
    } finally {
      unlink(inPath).catch(() => {});
      if (wavPath !== inPath) unlink(wavPath).catch(() => {});
    }
  }

  async encodeVideo(src: string): Promise<Vec> {
    const { bytes, mime } = await toBytes(src);
    const base = join(tmpdir(), randomUUID());
    const inPath = base + mimeToExt(mime);
    const framesDir = base + "_frames";

    await writeFile(inPath, bytes);
    await mkdir(framesDir);

    try {
      // Extract 1 frame every 5 seconds from the first 100 seconds (≤20 frames).
      // fps=1/5 produces evenly-spaced keyframes without needing scene detection.
      await new Promise<void>((res, rej) =>
        ffmpeg(inPath)
          .inputOptions(["-t", "100"])
          .outputOptions(["-vf", "fps=1/5"])
          .output(join(framesDir, "frame_%04d.jpg"))
          .on("end", () => res())
          .on("error", rej)
          .run()
      );

      let frameFiles = (await readdir(framesDir))
        .filter((f) => f.endsWith(".jpg"))
        .sort();

      // Fallback for very short videos (<5s): grab a single frame
      if (!frameFiles.length) {
        await new Promise<void>((res, rej) =>
          ffmpeg(inPath)
            .outputOptions(["-vf", "fps=1", "-frames:v", "1"])
            .output(join(framesDir, "frame_%04d.jpg"))
            .on("end", () => res())
            .on("error", rej)
            .run()
        );
        frameFiles = (await readdir(framesDir))
          .filter((f) => f.endsWith(".jpg"))
          .sort();
      }

      if (!frameFiles.length) {
        throw new Error("No frames could be extracted from video");
      }

      // Encode each frame with CLIP (reuses the cached image pipeline)
      const frameVecs: Vec[] = [];
      for (const frameFile of frameFiles) {
        const framePath = join(framesDir, frameFile);
        const frameBytes = await readFile(framePath);
        const dataUri = `data:image/jpeg;base64,${frameBytes.toString("base64")}`;
        frameVecs.push(await this.encodeImage(dataUri));
      }

      // Mean-pool frame vectors then L2-normalize into a single composite vector
      const dim = frameVecs[0].length;
      const pooled = new Array<number>(dim).fill(0);
      for (const vec of frameVecs) {
        for (let i = 0; i < dim; i++) pooled[i] += vec[i];
      }
      for (let i = 0; i < dim; i++) pooled[i] /= frameVecs.length;

      const norm = Math.sqrt(pooled.reduce((s, x) => s + x * x, 0));
      return pooled.map((x) => x / norm);
    } finally {
      await rm(framesDir, { recursive: true, force: true }).catch(() => {});
      await unlink(inPath).catch(() => {});
    }
  }
}
