import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/lib/db/generated/client";

// Um client só, no `globalThis`, para o HMR não abrir uma conexão nova a cada recarga.
const globalForDb = globalThis as unknown as { snkDb?: PrismaClient };

export function databaseUrl(): string {
  // No container o compose define `DATABASE_URL`; no `pnpm dev` vale o mesmo padrão do prisma.config.ts.
  const url = process.env.DATABASE_URL ?? (process.env.NODE_ENV === "development" ? "file:./prisma/dev.db" : undefined);
  if (!url) throw new Error("DATABASE_URL não definida (o compose.yaml a define).");
  return url;
}

export function db(): PrismaClient {
  if (!globalForDb.snkDb) {
    globalForDb.snkDb = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl() }) });
  }
  return globalForDb.snkDb;
}
