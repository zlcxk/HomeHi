import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ali-oss/urllib 带有可选的 native/代理依赖，交给 Node 运行时按需加载。
  serverExternalPackages: ["@prisma/client", "sharp", "nodemailer", "archiver", "ali-oss"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
