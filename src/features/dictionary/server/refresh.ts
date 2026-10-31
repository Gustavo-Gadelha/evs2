import "server-only";

import { invalidateDictionary, listTables } from "./dictionary";
import { localOnly } from "@/features/sankhya/server/local-only";

// Descarta o cache do perfil ativo e lê TDDTAB de novo no ERP; as colunas voltam a ser lidas sob demanda.
export const POST = localOnly(async () => {
  await invalidateDictionary();
  return Response.json(await listTables());
});
