import "server-only";

import type { Profile, ProfileInput, ProfileUpdate } from "../profiles";
import { decrypt, encrypt } from "@/lib/db/crypto";
import { db } from "@/lib/db/client";

type Secret = { appkey: string; token: string; username: string; password: string };

// Perfil completo, com segredos: só circula dentro do servidor.
export type FullProfile = Profile & Secret;

type Cache = { profiles: FullProfile[]; activeId: string | null };

// No `globalThis` para sobreviver ao HMR. Os segredos decifrados ficam só em memória; toda mutação recarrega.
const globalForProfiles = globalThis as typeof globalThis & { __profiles?: Cache };

const ACTIVE_KEY = "activeProfileId";

export class DuplicateProfileError extends Error {}
export class ProfileNotFoundError extends Error {}

async function reload(): Promise<Cache> {
  const [rows, setting] = await Promise.all([
    db().profile.findMany({ orderBy: { name: "asc" } }),
    db().appSetting.findUnique({ where: { key: ACTIVE_KEY } }),
  ]);
  const profiles = rows.map((row): FullProfile => {
    const secret = JSON.parse(decrypt(row.secret)) as Secret;
    return { id: row.id, name: row.name, baseUrl: row.baseUrl, ...secret };
  });
  // Perfil ativo que já não existe vira "nenhum".
  const activeId = profiles.some((profile) => profile.id === setting?.value) ? (setting?.value ?? null) : null;
  return (globalForProfiles.__profiles = { profiles, activeId });
}

async function load(): Promise<Cache> {
  return globalForProfiles.__profiles ?? reload();
}

function toPublic({ id, name, baseUrl, username }: FullProfile): Profile {
  return { id, name, baseUrl, username };
}

export async function listProfiles(): Promise<{ profiles: Profile[]; activeId: string | null }> {
  const { profiles, activeId } = await load();
  return { profiles: profiles.map(toPublic), activeId };
}

export async function getActiveProfile(): Promise<FullProfile | null> {
  const { profiles, activeId } = await load();
  return profiles.find((profile) => profile.id === activeId) ?? null;
}

export async function getProfile(id: string): Promise<FullProfile | null> {
  return (await load()).profiles.find((profile) => profile.id === id) ?? null;
}

// Todos os segredos conhecidos, lidos de forma síncrona pela redação de logs. Vazio até o primeiro `load`,
// que sempre acontece antes de qualquer chamada ao Sankhya.
export function knownSecrets(): string[] {
  const profiles = globalForProfiles.__profiles?.profiles ?? [];
  return profiles.flatMap((profile) => [profile.appkey, profile.token, profile.password]);
}

function secretOf({ appkey, token, username, password }: Secret): string {
  return encrypt(JSON.stringify({ appkey, token, username, password }));
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}

export async function createProfile(input: ProfileInput): Promise<void> {
  try {
    const profile = await db().profile.create({
      data: { id: crypto.randomUUID(), name: input.name, baseUrl: input.baseUrl, secret: secretOf(input) },
    });
    // O primeiro perfil cadastrado já fica ativo.
    const hasActive = (await load()).activeId !== null;
    if (!hasActive)
      await db().appSetting.upsert({
        where: { key: ACTIVE_KEY },
        create: { key: ACTIVE_KEY, value: profile.id },
        update: { value: profile.id },
      });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateProfileError(`Já existe um perfil chamado "${input.name}".`);
    throw err;
  }
  await reload();
}

export async function updateProfile(id: string, input: ProfileUpdate): Promise<void> {
  const current = await getProfile(id);
  if (!current) throw new ProfileNotFoundError("Perfil não encontrado.");

  // Em branco mantém o valor guardado.
  const keep = (next: string | undefined, old: string) => (next ? next : old);
  const secret: Secret = {
    appkey: keep(input.appkey, current.appkey),
    token: keep(input.token, current.token),
    username: keep(input.username, current.username),
    password: keep(input.password, current.password),
  };

  try {
    await db().profile.update({
      where: { id },
      data: { name: input.name ?? current.name, baseUrl: input.baseUrl ?? current.baseUrl, secret: secretOf(secret) },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateProfileError(`Já existe um perfil chamado "${input.name}".`);
    throw err;
  }
  await reload();
}

export async function deleteProfile(id: string): Promise<void> {
  await db().profile.deleteMany({ where: { id } });
  await reload();
}

export async function setActiveProfile(id: string | null): Promise<void> {
  if (id === null) {
    await db().appSetting.deleteMany({ where: { key: ACTIVE_KEY } });
  } else {
    if (!(await getProfile(id))) throw new ProfileNotFoundError("Perfil não encontrado.");
    await db().appSetting.upsert({
      where: { key: ACTIVE_KEY },
      create: { key: ACTIVE_KEY, value: id },
      update: { value: id },
    });
  }
  await reload();
}
