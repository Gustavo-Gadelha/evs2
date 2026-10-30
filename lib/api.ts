import type { ApiError } from "./types";

// `fetch` JSON para as rotas `/api/*`: devolve o corpo ou lança `Error` com a mensagem da API.
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data as ApiError | null)?.error?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return data as T;
}
