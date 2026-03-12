// Twitter/X reads twitter:image independently of og:image.
// Re-export the same dynamic image so the embed is identical everywhere.
export {
  default,
  runtime,
  alt,
  size,
  contentType,
} from "./opengraph-image";
