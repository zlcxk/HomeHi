FROM node:22-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npx next build

RUN mkdir -p data storage backups

EXPOSE 3000

# `next start` after migrations. The worker runs as a separate service with the
# same image (command: npm run worker:prod) and shares data/ and storage/.
CMD ["sh", "-c", "node scripts/ensure-dirs.mjs && npx prisma migrate deploy && npx next start"]
