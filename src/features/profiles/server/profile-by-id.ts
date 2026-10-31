import "server-only";

import { z } from "zod";

import { guard, invalid, updateSchema } from "./profiles";
import { deleteProfile, getProfile, listProfiles, updateProfile } from "./store";
import { clearToken, logoutIfActive } from "@/features/sankhya/server/auth";
import { localOnly } from "@/features/sankhya/server/local-only";

type Context = { params: Promise<{ id: string }> };

export const PATCH = localOnly(async (req, { params }: Context) =>
  guard(async () => {
    const { id } = await params;
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return invalid(z.prettifyError(parsed.error));
    await updateProfile(id, parsed.data);
    // Credenciais ou URL novas: o token em cache deixa de valer.
    await dropSession(id);
    return Response.json(await listProfiles());
  }),
);

export const DELETE = localOnly(async (_req, { params }: Context) =>
  guard(async () => {
    const { id } = await params;
    if (await getProfile(id)) await dropSession(id, true);
    await deleteProfile(id);
    return Response.json(await listProfiles());
  }),
);

// Encerra a sessão guardada se ela for do perfil `id`. Ao excluir, tenta o logout no Sankhya antes.
async function dropSession(id: string, remote = false) {
  if (remote) await logoutIfActive(id);
  else clearToken(id);
}
