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

EXPOSE 8080

CMD ["node", "dist/src/index.js"]
