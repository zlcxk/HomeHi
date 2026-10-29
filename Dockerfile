# HomeHi 生产镜像。
#
# 同一份 Dockerfile 产出两个运行目标，docker compose 通过 target 分别构建：
#   web    Next.js standalone 服务器：只包含追踪后的运行时产物，不带构建工具和
#          ffmpeg；迁移需要的 Prisma CLI 单独安装。
#   worker 提醒投递与媒体处理：只装生产依赖 + ffmpeg，用 tsx 直接运行 TypeScript，
#          不安装 prisma CLI、typescript、vitest 等工具。
#
# 构建依赖、完整 node_modules 和 ffmpeg 都不会进入最终镜像。

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/debian.sources \
  && sed -i 's/security.debian.org/mirrors.tuna.tsinghua.edu.cn\/debian-security/g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# 安装依赖（仅构建阶段）
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
# generate 需要 schema，先于安装复制进来。
COPY prisma ./prisma
RUN npm config set registry https://registry.npmmirror.com \
  && npm ci --ignore-scripts \
  && ./node_modules/.bin/prisma generate

# ---------------------------------------------------------------------------
# 构建：生成 Prisma Client 与 .next/standalone
# ---------------------------------------------------------------------------
FROM deps AS builder
COPY . .
ENV NEXT_OUTPUT=standalone
RUN npm run build

# ---------------------------------------------------------------------------
# 迁移用的 Prisma CLI：单独安装，避免把整套 node_modules 带进 web 镜像。
# 版本直接读 package.json，保证与构建期生成 Client 的版本一致。
# ---------------------------------------------------------------------------
FROM base AS prisma-cli
WORKDIR /cli
COPY package.json /tmp/app-package.json
RUN npm init -y > /dev/null \
  && npm config set registry https://registry.npmmirror.com \
  && npm install --no-audit --no-fund \
       "prisma@$(node -p 'require("/tmp/app-package.json").devDependencies.prisma')"

# ---------------------------------------------------------------------------
# web 运行镜像
# ---------------------------------------------------------------------------
FROM base AS web
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/ensure-dirs.mjs ./scripts/ensure-dirs.mjs

# 只有数据库迁移需要 CLI；运行时依赖已由 standalone 追踪打包。
COPY --from=prisma-cli /cli/node_modules ./node_modules

# 数据目录由卷挂载或 ensure-dirs 在启动时创建，镜像里不应带本地数据库。
RUN rm -rf data storage backups

EXPOSE 3000
CMD ["sh", "-c", "node scripts/ensure-dirs.mjs && ./node_modules/.bin/prisma migrate deploy && node server.js"]

# ---------------------------------------------------------------------------
# worker 运行镜像
# ---------------------------------------------------------------------------
FROM base AS worker

# 视频转码与封面抽取依赖 ffmpeg；web 镜像不需要，因此只装在这里。
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
  && npm ci --omit=dev --ignore-scripts

# worker 直接运行 TypeScript 源码，需要 tsconfig 里的 @/ 路径别名。
COPY tsconfig.json ./
COPY scripts ./scripts
COPY lib ./lib
COPY prisma ./prisma

# Client 在 deps 阶段生成，运行镜像不需要 prisma CLI，也不必等 web 构建完成。
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

# Next/React 只服务 web，删掉可以显著缩小 worker 镜像。
RUN rm -rf node_modules/next node_modules/@next node_modules/react node_modules/react-dom node_modules/lucide-react \
  && mkdir -p data storage backups

CMD ["npm", "run", "worker:prod"]
