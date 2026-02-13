import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/signing.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  outExtension({ format }) {
    return { js: format === "esm" ? ".mjs" : ".cjs" };
  },
  // 👇 This is the key line
  noExternal: ["@provenancekit/sdk"],
});
