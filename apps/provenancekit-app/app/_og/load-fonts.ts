// Stable CDN URLs — no CSS parsing required
const JSDELIVR = "https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk/files";

async function fetchFont(weight: 500 | 700) {
  try {
    const res = await fetch(
      `${JSDELIVR}/space-grotesk-latin-${weight}-normal.woff2`
    );
    return res.ok ? res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function loadOgFonts() {
  const [regular, bold] = await Promise.all([
    fetchFont(500),
    fetchFont(700),
  ]);

  const fonts: {
    name: string;
    data: ArrayBuffer;
    weight: number;
    style: "normal";
  }[] = [];

  if (regular)
    fonts.push({ name: "Space Grotesk", data: regular, weight: 500, style: "normal" });
  if (bold)
    fonts.push({ name: "Space Grotesk", data: bold, weight: 700, style: "normal" });

  return fonts;
}
