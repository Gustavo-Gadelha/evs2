import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/lib/db/generated/client";

// Um client só, no `globalThis`, para o HMR não abrir uma conexão nova a cada recarga.
const globalForDb = globalThis as unknown as { snkDb?: PrismaClient };

export function db(): PrismaClient {
  if (!globalForDb.snkDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não definida (o compose.yaml a define).");
    globalForDb.snkDb = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  }
  return globalForDb.snkDb;
}
