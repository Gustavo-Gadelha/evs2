import "server-only";

import { getAuthStatus, relogin } from "./auth";
import { localOnly } from "./local-only";

// Força um novo login, encerrando antes a sessão existente (mesmo que já inválida). Devolve só quando
// autenticou: o token nunca sai do servidor.
export const POST = localOnly(async () => {
  await relogin();
  return Response.json({ ok: true, authenticatedAt: (await getAuthStatus()).authenticatedAt });
});
