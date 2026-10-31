import { api } from "@/lib/api";

// Perfil como o navegador o vê: sem appkey, token nem senha (esses nunca saem do servidor).
export type Profile = { id: string; name: string; baseUrl: string; username: string };

export type ProfileInput = {
  name: string;
  baseUrl: string;
  appkey: string;
  token: string;
  username: string;
  password: string;
};

// Na edição, appkey/token/senha em branco mantêm o valor guardado.
export type ProfileUpdate = Partial<ProfileInput>;

export type ProfilesState = { profiles: Profile[]; activeId: string | null };

const JSON_HEADERS = { method: "POST" } as const;

export const profiles = {
  list: () => api<ProfilesState>("/api/profiles"),
  create: (input: ProfileInput) =>
    api<ProfilesState>("/api/profiles", { ...JSON_HEADERS, body: JSON.stringify(input) }),
  update: (id: string, input: ProfileUpdate) =>
    api<ProfilesState>(`/api/profiles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => api<ProfilesState>(`/api/profiles/${id}`, { method: "DELETE" }),
  activate: (id: string | null) =>
    api<ProfilesState>("/api/profiles/active", { ...JSON_HEADERS, body: JSON.stringify({ id }) }),
};
