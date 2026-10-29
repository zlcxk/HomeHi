import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 构建时输出 standalone，只拷贝追踪后的运行时文件；本地构建保持默认，
  // 这样 `npm run start`（next start）仍然可用。
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // ali-oss/urllib 带有可选的 native/代理依赖，交给 Node 运行时按需加载。
  serverExternalPackages: ["@prisma/client", "sharp", "nodemailer", "archiver", "ali-oss"],
  // 页面都是登录后的动态渲染，保留一小段客户端缓存，来回切换时不必重新请求。
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
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
