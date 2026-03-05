/** @type {import('next').NextConfig} */
export default {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    "@provenancekit/sdk",
    "@provenancekit/ui",
    "@provenancekit/extensions",
  ],
};
