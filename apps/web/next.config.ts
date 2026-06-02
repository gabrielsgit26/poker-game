import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@telegram-poker/shared", "@telegram-poker/poker-engine"],
};

export default nextConfig;
