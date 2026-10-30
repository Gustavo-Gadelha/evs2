import "server-only";

import { getEnv } from "@/lib/env";
import { SankhyaAuthError, SankhyaTimeoutError, isTimeout } from "./errors";
import { log } from "./redact";
import { authState } from "./state";

// Reference: https://developer.sankhya.com.br/reference/post_login-1
const TIMEOUT_MS = 10_000;

function baseUrl(): string {
  return getEnv().SANKHYA_BASE_URL.replace(/\/+$/, "");
}

function credentialHeaders(): Record<string, string> {
  const env = getEnv();
  return {
    appkey: env.SANKHYA_APPKEY,
    token: env.SANKHYA_TOKEN,
    username: env.SANKHYA_USERNAME,
    password: env.SANKHYA_PASSWORD,
  };
}

async function post(url: string, headers: Record<string, string>, action: string): Promise<Response> {
  try {
    return await fetch(url, { method: "POST", headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (err) {
    if (isTimeout(err)) {
      log.error(`Sankhya ${action} timed out after ${TIMEOUT_MS / 1000}s: POST ${url}`);
      throw new SankhyaTimeoutError(undefined, { cause: err });
    }
    log.error(`Sankhya ${action} request failed: POST ${url}`, err);
    throw new SankhyaAuthError(undefined, { cause: err });
  }
}

async function login(): Promise<string> {
  const url = `${baseUrl()}/login`;
  const response = await post(url, credentialHeaders(), "login");

  if (!response.ok) {
    log.error(`Sankhya login returned ${response.status} ${response.statusText}: POST ${url}`);
    throw new SankhyaAuthError(`Login recusado pelo Sankhya (${response.status} ${response.statusText}).`);
  }

  let data: { bearerToken?: unknown; error?: unknown };
  try {
    data = await response.json();
  } catch (err) {
    log.error(`Sankhya login returned a non-JSON body: POST ${url}`, err);
    throw new SankhyaAuthError("O login do Sankhya não retornou JSON.", { cause: err });
  }

  if (data.error !== undefined && data.error !== null) {
    log.error(`Sankhya login returned an error: ${JSON.stringify(data.error)}`);
    throw new SankhyaAuthError(`O login do Sankhya retornou um erro: ${JSON.stringify(data.error)}`);
  }

  if (typeof data.bearerToken !== "string" || !data.bearerToken) {
    log.error(`Sankhya login response has no bearerToken: POST ${url}`);
    throw new SankhyaAuthError("A resposta do login do Sankhya não tem bearerToken.");
  }

  return data.bearerToken;
}

export async function authenticate(): Promise<string> {
  const state = authState();

  state.pendingLogin ??= login()
    .then((bearerToken) => {
      state.bearerToken = bearerToken;
      state.authenticatedAt = new Date().toISOString();
      log.info("Login realizado.");
      return bearerToken;
    })
    .finally(() => {
      state.pendingLogin = null;
    });

  return state.pendingLogin;
}

// Autentica sob demanda na primeira requisição e reaproveita o token em cache.
export async function getBearerToken(): Promise<string> {
  return authState().bearerToken ?? authenticate();
}

export function clearToken(): void {
  const state = authState();
  state.bearerToken = null;
  state.authenticatedAt = null;
}

export async function logout(): Promise<void> {
  const { bearerToken } = authState();
  if (bearerToken === null) return;

  const url = `${baseUrl()}/gateway/v1/mge/service.sbr?serviceName=MobileLoginSP.logout`;
  const response = await post(url, { ...credentialHeaders(), Authorization: `Bearer ${bearerToken}` }, "logout");

  if (!response.ok) {
    log.error(`Sankhya logout returned ${response.status} ${response.statusText}: POST ${url}`);
    throw new SankhyaAuthError(`Logout recusado pelo Sankhya (${response.status} ${response.statusText}).`);
  }

  clearToken();
  log.info("Logout realizado.");
}

export function getAuthStatus() {
  const { bearerToken, authenticatedAt } = authState();
  return { authenticated: bearerToken !== null, authenticatedAt, baseUrl: baseUrl() };
}
