import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "tracker/index": "src/tracker/index.ts",
    "ai/index": "src/ai/index.ts",
    "integrations/github": "src/integrations/github.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["simple-git", "@octokit/rest", "zod"],
  splitting: false,
});
