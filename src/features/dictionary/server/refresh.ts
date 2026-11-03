import "server-only";

import { invalidateDictionary, listTables } from "./dictionary";
import { markIndexStale } from "@/features/assistant/server/index-store";
import { localOnly } from "@/features/sankhya/server/local-only";

// Descarta o cache do perfil ativo e lê TDDTAB de novo no ERP; as colunas voltam a ser lidas sob demanda.
// O índice do assistente só é marcado como desatualizado: reconstruí-lo sozinho seria caro na CPU.
export const POST = localOnly(async () => {
  await invalidateDictionary();
  await markIndexStale().catch(() => {});
  return Response.json(await listTables());
});
