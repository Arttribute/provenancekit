import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Stub env vars so config.ts Zod validation passes without real services.
    // The context module is mocked in tests so these values are never used.
    env: {
      NODE_ENV: "test",
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_ANON_KEY: "test-anon-key",
      PINATA_JWT: "test-pinata-jwt",
      PROOF_POLICY: "off",
    },
  },
});
