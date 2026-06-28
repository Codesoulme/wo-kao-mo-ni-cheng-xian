import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["192.168.1.5", "localhost", "127.0.0.1"],
  // 把 ADMIN_TOKEN 同步一份到 NEXT_PUBLIC_ADMIN_TOKEN，让前端按钮 fetch 时带上 x-admin-token。
  // dev 默认空字符串 → 前端不带 header → 后端走 dev 放行分支，不影响现有 430 smoke。
  // 生产设 ADMIN_TOKEN 时，前端会自动带上，配套 requireAuth 校验。
  env: {
    NEXT_PUBLIC_ADMIN_TOKEN: process.env.ADMIN_TOKEN || "",
  },
};

export default nextConfig;
