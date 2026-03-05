export const toDataURI = (
  bytes: Uint8Array,
  mime = "application/octet-stream"
) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

/**  Guess “resource kind” from a MIME type  */
export function inferKindFromMime(
  mime: string
): "image" | "audio" | "video" | "text" | undefined {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  return undefined;
}

