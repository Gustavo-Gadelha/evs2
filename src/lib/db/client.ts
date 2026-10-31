import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/db/generated/client";

// Um client só, no `globalThis`, para o HMR não abrir um pool novo a cada recarga.
const globalForDb = globalThis as unknown as { __db?: PrismaClient };

export function databaseUrl(): string {
  // No container o compose define `DATABASE_URL`; no `pnpm dev` ela vem do `.env` (ver `.env.example`).
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida (copie .env.example para .env ou use o compose.yaml).");
  return url;
}

export function db(): PrismaClient {
  if (!globalForDb.__db) {
    globalForDb.__db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
  }
  return globalForDb.__db;
}
