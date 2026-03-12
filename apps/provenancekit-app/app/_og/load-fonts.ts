import { SPACE_GROTESK_WOFF2_B64 } from "./font-data";

// Decode the embedded base64 font into an ArrayBuffer.
// No network calls — font is baked into the edge function bundle.
function decodeFont(): ArrayBuffer {
  const binary = atob(SPACE_GROTESK_WOFF2_B64);
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
  // Register the same variable-font file for both weights so Satori
  // resolves fontWeight: 500 and fontWeight: 700 in the JSX.
  return [
    { name: "Space Grotesk", data, weight: 500, style: "normal" },
    { name: "Space Grotesk", data, weight: 700, style: "normal" },
  ];
}
