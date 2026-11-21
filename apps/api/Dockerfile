FROM node:24-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NX_DAEMON=false \
    NX_NO_CLOUD=true \
    CI=true

RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --offline --frozen-lockfile \
  && pnpm nx run @team27/api:build --skip-nx-cache

ENV NODE_ENV=production \
    API_PORT=10000 \
    CHECKPOINT_DISABLE=1

EXPOSE 10000

CMD ["sh", "-c", "cd /repo/data/main && node_modules/.bin/prisma migrate deploy && cd /repo/apps/api && exec node dist/main.js"]
