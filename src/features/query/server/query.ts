import "server-only";

import { z } from "zod";

import { executeQuery } from "./execute";
import { localOnly } from "@/features/sankhya/server/local-only";
import { checkReadOnly } from "@/lib/sql/read-only";
import type { QueryResult } from "@/lib/types";

const bodySchema = z.object({ sql: z.string().trim().min(1).max(100_000) });

export const POST = localOnly(async (req) => {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { type: "InvalidRequest", message: z.prettifyError(parsed.error) } },
      { status: 400 },
    );
  }

  const { sql } = parsed.data;
  const check = checkReadOnly(sql);
  if (!check.ok) {
    return Response.json({ error: { type: "ReadOnlyViolation", message: check.reason } }, { status: 400 });
  }

  return Response.json((await executeQuery(sql)) satisfies QueryResult);
});
