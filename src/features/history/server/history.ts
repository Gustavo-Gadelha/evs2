import "server-only";

import { z } from "zod";

import { addHistory, clearHistory, listHistory } from "./store";
import { localOnly } from "@/features/sankhya/server/local-only";

const bodySchema = z.object({
  sql: z.string().max(100_000),
  state: z.looseObject({}),
  manual: z.boolean(),
  rowCount: z.number().int().nonnegative().nullable(),
  error: z.string().max(10_000).nullable(),
  result: z
    .object({
      columns: z.array(z.string()),
      rows: z.array(z.array(z.unknown())),
      durationMs: z.number(),
      raw: z.unknown(),
    })
    .optional(),
});

export const GET = localOnly(async () => Response.json(await listHistory()));

export const POST = localOnly(async (req) => {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { type: "InvalidRequest", message: z.prettifyError(parsed.error) } },
      { status: 400 },
    );
  }
  return Response.json(await addHistory(parsed.data as Parameters<typeof addHistory>[0]));
});

export const DELETE = localOnly(async () => {
  await clearHistory();
  return Response.json([]);
});
