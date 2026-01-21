import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/direct": "src/adapters/direct.ts",
    "adapters/splits": "src/adapters/splits.ts",
    "adapters/superfluid": "src/adapters/superfluid.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ["viem", "@0xsplits/splits-sdk", "@superfluid-finance/sdk-core"],
});
