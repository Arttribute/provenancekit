FROM cgr.dev/chainguard/node:latest-dev

USER root

WORKDIR /app

# Wolfi publishes continuously rebuilt packages with security fixes. ffmpeg is
# retained because audio/video provenance embeddings are a supported API path.
RUN apk add --no-cache ffmpeg

# pnpm deploy resolves all workspace:* deps into a real node_modules.
# cloudbuild.yaml writes this to apps/provenancekit-api/standalone/
COPY --chown=node:node standalone/node_modules ./node_modules
COPY --chown=node:node standalone/package.json ./package.json

# Compiled TypeScript output (built by tsc in cloudbuild step)
COPY --chown=node:node standalone/dist ./dist

# Pre-download CLIP ViT-Base/16 into the image at build time.
# This eliminates HuggingFace network calls (and rate-limit 429s) at runtime.
# Models are cached to /app/.cache and baked into the image layer.
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface/hub
USER node
# Write the preload script to /app/ so Node resolves @xenova/transformers from /app/node_modules
RUN printf 'import { pipeline, AutoTokenizer, CLIPTextModelWithProjection } from "@xenova/transformers";\n\
console.log("Pre-downloading Xenova/clip-vit-base-patch16...");\n\
await pipeline("image-feature-extraction", "Xenova/clip-vit-base-patch16");\n\
await AutoTokenizer.from_pretrained("Xenova/clip-vit-base-patch16");\n\
await CLIPTextModelWithProjection.from_pretrained("Xenova/clip-vit-base-patch16");\n\
console.log("CLIP models cached successfully.");\n' \
  > /app/preload.mjs && node /app/preload.mjs && rm /app/preload.mjs

EXPOSE 8080

ENTRYPOINT ["/usr/bin/node"]
CMD ["dist/src/index.js"]
