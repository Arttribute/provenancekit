/** @type {import('next').NextConfig} */
export default {
  typescript: {
    // Type-checking runs in CI — skip during Vercel build to prevent OOM
    ignoreBuildErrors: true,
  },
  eslint: {
    // Linting runs in CI — skip during Vercel build
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    "@provenancekit/sdk",
    "@provenancekit/ui",
    "@provenancekit/extensions",
  ],
};
