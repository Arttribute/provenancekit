import { ImageResponse } from "next/og";
import { loadOgFonts } from "./_og/load-fonts";
import { OgImageJsx } from "./_og/og-image-jsx";

// Must be declared directly in this file — Next.js cannot pick up re-exported segment config
export const runtime = "edge";
export const alt = "ProvenanceKit — Verifiable records of how it was made.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const fonts = await loadOgFonts();

  const imageOptions = fonts.length > 0 ? { ...size, fonts } : { ...size };

  return new ImageResponse(<OgImageJsx hasFonts={fonts.length > 0} />, imageOptions);
}
