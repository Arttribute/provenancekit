import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "reader/index": "src/reader/index.ts",
    "writer/index": "src/writer/index.ts",
    "converter/index": "src/converter/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  external: ["@contentauth/c2pa-node"],
});
