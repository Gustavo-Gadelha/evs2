import "server-only";

import { knownSecrets } from "@/features/profiles/server/store";
import { authState } from "./state";

const REDACTED = "[REDACTED]";

// Headers cujo valor nunca sai do servidor: as credenciais de login e o que identifica a sessão.
const SECRET_HEADERS = new Set(["appkey", "token", "username", "password", "authorization", "cookie", "set-cookie"]);

function secretValues(): string[] {
  // Segredos de todos os perfis, não só do ativo: nada vaza em log ao trocar de perfil.
  const values = [...knownSecrets(), authState().bearerToken];
  return values.filter((value): value is string => Boolean(value));
}

export function redactText(text: string): string {
  let result = text;
  for (const secret of secretValues()) {
    result = result.split(secret).join(REDACTED);
  }
  return result;
}

export function redactHeaders(headers: Headers | Record<string, string>): Record<string, string> {
  const entries = headers instanceof Headers ? [...headers.entries()] : Object.entries(headers);
  return Object.fromEntries(
    entries.map(([key, value]) => [key, SECRET_HEADERS.has(key.toLowerCase()) ? REDACTED : redactText(value)]),
  );
}

export const log = {
  error(message: string, err?: unknown) {
    const detail = err instanceof Error ? ` (${err.name}: ${err.message})` : "";
    console.error(`[sankhya] ${redactText(message + detail)}`);
  },
  info(message: string) {
    console.info(`[sankhya] ${redactText(message)}`);
  },
};
