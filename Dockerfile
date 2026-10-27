FROM node:22-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/debian.sources \
  && sed -i 's/security.debian.org/mirrors.tuna.tsinghua.edu.cn\/debian-security/g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# package.json 的 postinstall 会执行 `prisma generate`，因此 schema 必须先就位。
COPY prisma ./prisma
# 不要在这里之前设 NODE_ENV=production：npm 会因此跳过 devDependencies，
# 而构建和运行时都需要它们（@tailwindcss/postcss、prisma CLI、tsx）。
RUN npm config set registry https://registry.npmmirror.com && npm ci --ignore-scripts

COPY . .
RUN npm run build

RUN mkdir -p data storage backups

EXPOSE 3000

# `next start` after migrations. The worker runs as a separate service with the
# same image (command: npm run worker:prod) and shares data/ and storage/.
CMD ["sh", "-c", "node scripts/ensure-dirs.mjs && npx prisma migrate deploy && npx next start"]
