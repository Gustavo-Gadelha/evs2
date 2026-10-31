-- Converte o JSON que era guardado como texto; USING preserva as linhas existentes.
ALTER TABLE "HistoryEntry"
  ALTER COLUMN "state" TYPE JSONB USING "state"::jsonb,
  ALTER COLUMN "result" TYPE JSONB USING "result"::jsonb;

ALTER TABLE "SavedQuery"
  ALTER COLUMN "state" TYPE JSONB USING "state"::jsonb;
