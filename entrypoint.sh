#!/bin/sh
# Prepara o ambiente do container e entrega o processo ao comando (CMD).
set -eu

: "${DATABASE_URL:?DATABASE_URL não definida (o compose.yaml a define).}"
: "${SNK_ENCRYPTION_KEY:?SNK_ENCRYPTION_KEY não definida (o compose.yaml a define).}"

case "$DATABASE_URL" in
  postgres://* | postgresql://*) ;;
  *) echo "entrypoint: DATABASE_URL deve ser uma URL do Postgres." >&2; exit 1 ;;
esac

echo "entrypoint: aplicando migrations"
(cd /opt/prisma && ./node_modules/.bin/prisma migrate deploy)

# exec: o servidor vira PID 1 e recebe SIGTERM do `docker stop`.
exec "$@"
