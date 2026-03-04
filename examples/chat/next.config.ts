/** @type {import('next').NextConfig} */
export default {
  transpilePackages: [
    "@provenancekit/sdk",
    "@provenancekit/ui",
    "@provenancekit/extensions",
  ],
  experimental: {
    externalDir: true,
  },
};
