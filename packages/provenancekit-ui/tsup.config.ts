import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    styles: "src/styles/provenancekit.css",
  },
  format: ["esm", "cjs"],
  dts: true,
  external: ["react", "react-dom", "@xyflow/react"],
  clean: true,
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
