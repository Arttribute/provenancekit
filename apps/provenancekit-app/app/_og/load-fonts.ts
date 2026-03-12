// Font files live in public/fonts/ — served by our own CDN, no external dependency.
// Both weights use the same woff2 (Space Grotesk is a variable font; one file covers all weights).
// Hard fallback: direct gstatic URL (latin subset, v22) if our own CDN fetch somehow fails.

const GSTATIC_FALLBACK =
  "https://fonts.gstatic.com/s/spacegrotesk/v22/V8mDoQDjQSkFtoMM3T6r8E7mPbF4C_k3HqU.woff2";

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://provenancekit.com";
}

async function fetchFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    return res.ok ? res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function loadOgFonts(): Promise<
  { name: string; data: ArrayBuffer; weight: number; style: "normal" }[]
> {
  const base = getBaseUrl();

  // Try our own CDN first, fall back to gstatic
  const data =
    (await fetchFont(`${base}/fonts/space-grotesk-700.woff2`)) ??
    (await fetchFont(GSTATIC_FALLBACK));

  if (!data) return [];

  // Register the same variable-font file for both weights so Satori
  // can resolve fontWeight: 500 and fontWeight: 700 in the JSX.
  return [
    { name: "Space Grotesk", data, weight: 500, style: "normal" },
    { name: "Space Grotesk", data, weight: 700, style: "normal" },
  ];
}
