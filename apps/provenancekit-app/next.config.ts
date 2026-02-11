import path from "path";

/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@provenancekit/sdk"],
  experimental: {
    externalDir: true, // if not already set
  },
  webpack(config: { resolve: { alias: { [x: string]: string } } }) {
    // optional safety net
    config.resolve.alias["@provenancekit/sdk"] = path.resolve(
      __dirname,
      "../../packages/provenancekit-sdk/dist"
    );
    return config;
  },
};
