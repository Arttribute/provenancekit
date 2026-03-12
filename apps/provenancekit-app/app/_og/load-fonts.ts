import { SPACE_GROTESK_TTF_B64 } from "./font-data";

// Decode the embedded base64 TTF font into an ArrayBuffer.
// Satori (used by next/og) only supports TTF, OTF, and WOFF1 — NOT WOFF2.
// No network calls — font is baked into the edge function bundle.
function decodeFont(): ArrayBuffer {
  const binary = atob(SPACE_GROTESK_TTF_B64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function loadOgFonts(): {
  name: string;
  data: ArrayBuffer;
  weight: number;
  style: "normal";
}[] {
  const data = decodeFont();
  // Register the 700-weight TTF for both weights — Satori picks the closest
  // registered weight, so 500-weight text will render in 700 (slightly bolder
  // than ideal but correct and reliable).
  return [
    { name: "Space Grotesk", data, weight: 500, style: "normal" },
    { name: "Space Grotesk", data, weight: 700, style: "normal" },
  ];
}
