import "server-only";

import { InvalidPathError } from "./client";
import { SankhyaError } from "./errors";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function hostnameOf(host: string): string {
  // `Host` vem como `hostname[:porta]`; parsear como URL cobre as duas formas.
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return "";
  }
}

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") && LOCAL_HOSTNAMES.has(url.hostname);
  } catch {
    return false;
  }
}

// Fora de `development` as rotas não existem; em desenvolvimento, só aceitam o próprio navegador
// na máquina local (bloqueia DNS rebinding pelo `Host` e requisições cross-site pelo `Origin`).
function rejectNonLocal(request: Request): Response | null {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not Found", { status: 404 });
  }

  const host = request.headers.get("host");
  if (!host || !LOCAL_HOSTNAMES.has(hostnameOf(host))) {
    return Response.json({ error: { type: "Forbidden", message: "Host não local." } }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (origin !== null && !isLocalOrigin(origin)) {
    return Response.json({ error: { type: "Forbidden", message: "Origin não local." } }, { status: 403 });
  }

  return null;
}

export function errorResponse(err: unknown): Response {
  if (err instanceof InvalidPathError) {
    return Response.json({ error: { type: "InvalidPath", message: err.message } }, { status: 400 });
  }
  if (err instanceof SankhyaError) {
    return Response.json({ error: { type: err.name, message: err.message } }, { status: err.httpStatus });
  }
  console.error("[sankhya] Unexpected error", err instanceof Error ? err.name : typeof err);
  return Response.json({ error: { type: "InternalError", message: "Erro inesperado no servidor." } }, { status: 500 });
}

export function localOnly(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const rejection = rejectNonLocal(request);
    if (rejection) return rejection;
    try {
      return await handler(request);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
