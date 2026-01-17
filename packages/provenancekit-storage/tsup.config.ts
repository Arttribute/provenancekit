import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/db/index.ts",
    "src/files/index.ts",
    "src/utils/index.ts",
    "src/adapters/db/memory.ts",
    "src/adapters/db/postgres.ts",
    "src/adapters/db/mongodb.ts",
    "src/adapters/db/supabase.ts",
    "src/adapters/files/memory.ts",
    "src/adapters/files/ipfs-pinata.ts",
    "src/adapters/files/ipfs-infura.ts",
    "src/adapters/files/ipfs-local.ts",
    "src/adapters/files/web3storage.ts",
    "src/adapters/files/arweave.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
