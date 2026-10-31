import "server-only";

import { authenticate, clearToken, getAuthStatus } from "./auth";
import { localOnly } from "./local-only";

// Força um novo login. Devolve só quando autenticou: o token nunca sai do servidor.
export const POST = localOnly(async () => {
  clearToken();
  await authenticate();
  return Response.json({ ok: true, authenticatedAt: (await getAuthStatus()).authenticatedAt });
});
