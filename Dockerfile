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

# `public/` não é versionado quando está vazio, mas o estágio final o copia.
RUN mkdir -p public && pnpm build

FROM dependencies AS migrate

COPY prisma.config.ts ./
COPY prisma ./prisma

CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM node:26-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Ponto de montagem do volume `data`: criado com dono `node` para o SQLite poder gravar nele.
RUN mkdir /data && chown node:node /data

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

# 0.0.0.0 é só dentro do container; no host a porta é publicada apenas em 127.0.0.1 (compose.yaml).
EXPOSE 3100

CMD ["node", "server.js"]
