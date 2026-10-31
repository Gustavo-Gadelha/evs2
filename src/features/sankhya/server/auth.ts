import "server-only";

import { getActiveProfile, getProfile, type FullProfile } from "@/features/profiles/server/store";
import { NoActiveProfileError, SankhyaAuthError, SankhyaTimeoutError, isTimeout } from "./errors";
import { log } from "./redact";
import { authState } from "./state";

// Reference: https://developer.sankhya.com.br/reference/post_login-1
const TIMEOUT_MS = 10_000;

export async function requireProfile(): Promise<FullProfile> {
  const profile = await getActiveProfile();
  if (!profile) throw new NoActiveProfileError();
  return profile;
}

function baseUrl(profile: FullProfile): string {
  return profile.baseUrl.replace(/\/+$/, "");
}

function credentialHeaders(profile: FullProfile): Record<string, string> {
  return { appkey: profile.appkey, token: profile.token, username: profile.username, password: profile.password };
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

async function login(profile: FullProfile): Promise<string> {
  const url = `${baseUrl(profile)}/login`;
  const response = await post(url, credentialHeaders(profile), "login");

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
  const profile = await requireProfile();

  // Um login em andamento de outro perfil não serve a este.
  if (state.pendingLogin && state.pendingProfileId !== profile.id) state.pendingLogin = null;

  state.pendingProfileId = profile.id;
  state.pendingLogin ??= login(profile)
    .then((bearerToken) => {
      state.bearerToken = bearerToken;
      state.profileId = profile.id;
      state.authenticatedAt = new Date().toISOString();
      log.info(`Login realizado (perfil "${profile.name}").`);
      return bearerToken;
    })
    .finally(() => {
      state.pendingLogin = null;
      state.pendingProfileId = null;
    });

  return state.pendingLogin;
}

// Autentica sob demanda na primeira requisição e reaproveita o token em cache, se for do perfil ativo.
export async function getBearerToken(): Promise<string> {
  const state = authState();
  const profile = await requireProfile();
  if (state.bearerToken !== null && state.profileId === profile.id) return state.bearerToken;
  clearToken();
  return authenticate();
}

// Sem `profileId`, limpa a sessão guardada; com ele, só se for desse perfil.
export function clearToken(profileId?: string): void {
  const state = authState();
  if (profileId !== undefined && state.profileId !== profileId) return;
  state.bearerToken = null;
  state.authenticatedAt = null;
  state.profileId = null;
}

async function logoutProfile(profile: FullProfile, bearerToken: string): Promise<void> {
  const url = `${baseUrl(profile)}/gateway/v1/mge/service.sbr?serviceName=MobileLoginSP.logout`;
  const response = await post(url, { ...credentialHeaders(profile), Authorization: `Bearer ${bearerToken}` }, "logout");

  if (!response.ok) {
    log.error(`Sankhya logout returned ${response.status} ${response.statusText}: POST ${url}`);
    throw new SankhyaAuthError(`Logout recusado pelo Sankhya (${response.status} ${response.statusText}).`);
  }
}

export async function logout(): Promise<void> {
  const { bearerToken, profileId } = authState();
  if (bearerToken === null || profileId === null) return;

  const profile = await getProfile(profileId);
  if (profile) await logoutProfile(profile, bearerToken);

  clearToken();
  log.info("Logout realizado.");
}

// Usado ao trocar, editar ou excluir um perfil: tenta o logout no Sankhya, mas o erro nunca impede a operação.
export async function logoutIfActive(profileId: string): Promise<void> {
  if (authState().profileId !== profileId) return;
  try {
    await logout();
  } catch (err) {
    log.error("Logout ao trocar de perfil falhou; a sessão local foi descartada.", err);
  } finally {
    clearToken(profileId);
  }
}

export async function getAuthStatus() {
  const { bearerToken, authenticatedAt, profileId } = authState();
  const profile = await getActiveProfile();
  return {
    authenticated: bearerToken !== null && profile !== null && profileId === profile.id,
    authenticatedAt,
    baseUrl: profile ? baseUrl(profile) : null,
    profile: profile ? { id: profile.id, name: profile.name } : null,
  };
}
