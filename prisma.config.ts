import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // No container o compose define `DATABASE_URL` (volume em /data); o padrão serve só aos comandos rodados no host.
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
