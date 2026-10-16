/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/**/*": ["./data/bm25-index.json"],
    },
  },
};

export default nextConfig;
