import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@provenancekit/ui"],
  // Allow embedding in iframes from the docs domain
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
