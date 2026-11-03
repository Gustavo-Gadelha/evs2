-- Busca textual sem acento no índice do assistente (a busca vetorial usa a extensão `vector`, da migration anterior).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateTable
CREATE TABLE "AiIndex" (
    "erpKey" TEXT NOT NULL,
    "embedModel" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "builtAt" TIMESTAMP(3) NOT NULL,
    "stale" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AiIndex_pkey" PRIMARY KEY ("erpKey")
);

-- CreateTable
CREATE TABLE "AiDocument" (
    "id" TEXT NOT NULL,
    "erpKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector NOT NULL,

    CONSTRAINT "AiDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiDocument_erpKey_kind_idx" ON "AiDocument"("erpKey", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AiDocument_erpKey_kind_ref_key" ON "AiDocument"("erpKey", "kind", "ref");
