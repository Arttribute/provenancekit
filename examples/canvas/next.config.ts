/** @type {import('next').NextConfig} */
export default {
  transpilePackages: [
    "@provenancekit/sdk",
    "@provenancekit/ui",
    "@provenancekit/extensions",
    "@provenancekit/payments",
    "@provenancekit/media",
  ],
  experimental: {
    externalDir: true,
  },
};
