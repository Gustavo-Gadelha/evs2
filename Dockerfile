# Único estágio, só desenvolvimento: esta ferramenta nunca tem build de produção.
FROM node:24-alpine

ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true

WORKDIR /app

# pnpm na versão fixada em `packageManager` do package.json.
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

EXPOSE 3100

# O código-fonte chega pelo bind mount do compose. O `pnpm install` na subida mantém o volume de
# node_modules em dia quando o lockfile muda (e é rápido quando nada mudou).
# 0.0.0.0 é só dentro do container; no host a porta é publicada apenas em 127.0.0.1 (compose.yaml).
CMD ["sh", "-c", "pnpm install --frozen-lockfile && exec pnpm exec next dev -H 0.0.0.0 -p 3100"]
