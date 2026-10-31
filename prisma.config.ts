import { defineConfig } from "prisma/config";

// O Prisma CLI não lê `.env` sozinho; no container `DATABASE_URL` já vem do ambiente e não há arquivo.
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
