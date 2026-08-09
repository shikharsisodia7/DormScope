/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@dormscope/shared", "@dormscope/scoring", "@dormscope/database"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
};

export default nextConfig;
