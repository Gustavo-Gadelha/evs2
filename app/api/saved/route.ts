import { z } from "zod";

import { addSaved, listSaved } from "@/lib/db/store";
import { localOnly } from "@/lib/sankhya/route";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  sql: z.string().max(100_000),
  state: z.looseObject({}),
  manual: z.boolean(),
  // Só para importar consultas antigas do localStorage mantendo a data original.
  savedAt: z.iso.datetime().optional(),
});

export const GET = localOnly(async () => Response.json(await listSaved()));

export const POST = localOnly(async (req) => {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { type: "InvalidRequest", message: z.prettifyError(parsed.error) } }, { status: 400 });
  }
  return Response.json(await addSaved(parsed.data as Parameters<typeof addSaved>[0]));
});
