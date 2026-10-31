import "server-only";

import { z } from "zod";

import { guard, invalid } from "./profiles";
import { listProfiles, setActiveProfile } from "./store";
import { logoutIfActive } from "@/features/sankhya/server/auth";
import { localOnly } from "@/features/sankhya/server/local-only";

const bodySchema = z.object({ id: z.string().min(1).nullable() });

// Troca o perfil ativo: encerra a sessão do anterior (o login do novo acontece sob demanda).
export const POST = localOnly(async (req) =>
  guard(async () => {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return invalid(z.prettifyError(parsed.error));

    const { activeId } = await listProfiles();
    if (activeId !== null && activeId !== parsed.data.id) await logoutIfActive(activeId);
    await setActiveProfile(parsed.data.id);
    return Response.json(await listProfiles());
  }),
);
