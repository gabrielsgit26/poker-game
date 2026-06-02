import type { NextConfig } from "next";

const proxy =
  process.env.API_PROXY_TARGET?.trim() ??
  process.env.NEXT_PUBLIC_API_PROXY_TARGET?.trim();

const nextConfig: NextConfig = {
  transpilePackages: ["@telegram-poker/shared"],
  async rewrites() {
    if (!proxy) return [];
    const base = proxy.replace(/\/$/, "");
    return [
      { source: "/api/:path*", destination: `${base}/:path*` },
      { source: "/socket.io/:path*", destination: `${base}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
