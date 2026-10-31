import "server-only";

import { authenticate, clearToken, getBearerToken, requireProfile } from "./auth";
import { SankhyaClientError, SankhyaTimeoutError, isTimeout, type UpstreamResponse } from "./errors";
import { log, redactHeaders, redactText } from "./redact";

const TIMEOUT_MS = 30_000;

export type RequestOptions = {
  query?: Record<string, string>;
  body?: unknown;
};

export class InvalidPathError extends Error {}

// Aceita só caminhos relativos à base URL do perfil ativo, para que o proxy não seja apontado para outro host.
export function resolveUrl(baseUrl: string, path: string, query?: Record<string, string>): URL {
  const base = new URL(`${baseUrl.replace(/\/+$/, "")}/`);
  const trimmed = path.trim();

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    throw new InvalidPathError("Use um caminho relativo à base URL do perfil, não uma URL absoluta.");
  }
  if (trimmed.includes("\\")) {
    throw new InvalidPathError("O caminho não pode conter barra invertida.");
  }

  const pathOnly = trimmed.split(/[?#]/, 1)[0];
  const segments = pathOnly.split("/").map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
  if (segments.some((segment) => segment === ".." || segment === ".")) {
    throw new InvalidPathError("O caminho não pode conter segmentos `..` ou `.`.");
  }

  const url = new URL(trimmed.replace(/^\/+/, ""), base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new InvalidPathError("O caminho resolve para fora da base URL do perfil.");
  }
  if (url.pathname.replace(base.pathname, "").replace(/\/+$/, "") === "login") {
    throw new InvalidPathError("Use o botão Login: o endpoint /login não passa pelo proxy.");
  }

  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.append(key, value);
  }
  return url;
}

function buildHeaders(bearerToken: string, hasBody: boolean): Headers {
  const headers = new Headers({ Authorization: `Bearer ${bearerToken}` });
  if (hasBody) headers.set("Content-Type", "application/json");
  return headers;
}

async function snapshot(response: Response, startedAt: number): Promise<UpstreamResponse> {
  const text = redactText(await response.text());
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Corpo não JSON: devolvido como texto.
  }
  return {
    status: response.status,
    statusText: response.statusText,
    durationMs: Math.round(performance.now() - startedAt),
    headers: redactHeaders(response.headers),
    body,
  };
}

async function send(method: string, url: URL, bearerToken: string, options: RequestOptions): Promise<Response> {
  const hasBody = options.body !== undefined && method !== "GET";
  try {
    return await fetch(url, {
      method,
      headers: buildHeaders(bearerToken, hasBody),
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    if (isTimeout(err)) {
      log.error(`Sankhya API timed out after ${TIMEOUT_MS / 1000}s: ${method} ${url}`);
      throw new SankhyaTimeoutError(undefined, { cause: err });
    }
    log.error(`Could not reach the Sankhya API: ${method} ${url}`, err);
    throw new SankhyaClientError("Não foi possível conectar à API do Sankhya.", { cause: err });
  }
}

export async function request(method: string, path: string, options: RequestOptions = {}): Promise<UpstreamResponse> {
  const url = resolveUrl((await requireProfile()).baseUrl, path, options.query);
  const startedAt = performance.now();

  let response = await send(method, url, await getBearerToken(), options);

  // Token expirado ou revogado: um novo login e uma única nova tentativa, sem laço.
  if (response.status === 401) {
    log.info(`Sankhya API returned 401, re-authenticating once: ${method} ${url}`);
    clearToken();
    response = await send(method, url, await authenticate(), options);
  }

  const result = await snapshot(response, startedAt);

  if (!response.ok) {
    log.error(`Sankhya API returned ${response.status} ${response.statusText}: ${method} ${url}`);
    throw new SankhyaClientError(`O Sankhya respondeu ${response.status} ${response.statusText}.`, {
      response: result,
    });
  }

  return result;
}
