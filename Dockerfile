FROM node:26-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true

WORKDIR /app

# O Node 26 não traz mais o corepack; a versão do pnpm acompanha `packageManager` do package.json.
RUN npm install -g pnpm@12.6.0

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM dependencies AS builder

COPY . .

RUN pnpm build

FROM node:26-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# CLI do Prisma isolado (o standalone não o inclui), usado pelo entrypoint para aplicar as migrations.
WORKDIR /opt/prisma

# Deve acompanhar a versão do `prisma` em pnpm-lock.yaml.
RUN npm install --no-save --no-audit --no-fund prisma@7.10.1 \
    && chown -R node:node /opt/prisma

COPY --chown=node:node prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
COPY --chmod=755 entrypoint.sh /entrypoint.sh

WORKDIR /app

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

# 0.0.0.0 é só dentro do container; no host a porta é publicada apenas em 127.0.0.1 (compose.yaml).
EXPOSE 3100

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
