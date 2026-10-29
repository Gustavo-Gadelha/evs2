import { authenticate, clearToken, getAuthStatus } from "@/lib/sankhya/auth";
import { localOnly } from "@/lib/sankhya/route";

// Força um novo login. Devolve só quando autenticou: o token nunca sai do servidor.
export const POST = localOnly(async () => {
  clearToken();
  await authenticate();
  return Response.json({ ok: true, authenticatedAt: getAuthStatus().authenticatedAt });
});
