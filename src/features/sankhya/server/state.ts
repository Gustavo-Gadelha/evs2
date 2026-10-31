import "server-only";

type AuthState = {
  bearerToken: string | null;
  authenticatedAt: string | null;
  // Perfil dono do token: trocar de perfil invalida o token em cache.
  profileId: string | null;
  // Login em andamento, compartilhado para que requisições simultâneas não disparem vários logins.
  pendingLogin: Promise<string> | null;
  pendingProfileId: string | null;
};

const globalForSankhya = globalThis as typeof globalThis & { __sankhyaAuth?: AuthState };

// Guarda só dados (não instâncias de classe) em `globalThis`: sobrevive ao HMR do `next dev`
// sem prender versões antigas dos módulos.
export function authState(): AuthState {
  globalForSankhya.__sankhyaAuth ??= {
    bearerToken: null,
    authenticatedAt: null,
    profileId: null,
    pendingLogin: null,
    pendingProfileId: null,
  };
  return globalForSankhya.__sankhyaAuth;
}
