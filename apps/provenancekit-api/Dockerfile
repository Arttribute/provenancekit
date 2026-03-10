FROM node:22-slim

WORKDIR /app

# Install ffmpeg (needed by fluent-ffmpeg for audio/video embeddings)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# pnpm deploy resolves all workspace:* deps into a real node_modules.
# cloudbuild.yaml writes this to apps/provenancekit-api/standalone/
COPY standalone/node_modules ./node_modules
COPY standalone/package.json ./package.json

# Compiled TypeScript output (built by tsc in cloudbuild step)
COPY standalone/dist ./dist

# Pre-download CLIP ViT-Base/16 into the image at build time.
# This eliminates HuggingFace network calls (and rate-limit 429s) at runtime.
# Models are cached to /app/.cache and baked into the image layer.
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface/hub
RUN printf 'import { pipeline, AutoTokenizer, CLIPTextModelWithProjection } from "@xenova/transformers";\n\
console.log("Pre-downloading Xenova/clip-vit-base-patch16...");\n\
await pipeline("image-feature-extraction", "Xenova/clip-vit-base-patch16");\n\
await AutoTokenizer.from_pretrained("Xenova/clip-vit-base-patch16");\n\
await CLIPTextModelWithProjection.from_pretrained("Xenova/clip-vit-base-patch16");\n\
console.log("CLIP models cached successfully.");\n' \
  > /tmp/preload.mjs && node /tmp/preload.mjs && rm /tmp/preload.mjs

EXPOSE 8080

CMD ["node", "dist/src/index.js"]
