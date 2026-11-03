-- Hash do texto que gerou o embedding: a reindexação só recalcula o que mudou. Linhas antigas (e as importadas por
-- `pnpm ai:import`) ficam sem hash e são recalculadas na próxima indexação.
ALTER TABLE "AiDocument" ADD COLUMN "hash" TEXT;
