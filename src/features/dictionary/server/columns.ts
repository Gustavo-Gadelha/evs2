import "server-only";

import { InvalidTableError, listColumns } from "./dictionary";
import { localOnly } from "@/features/sankhya/server/local-only";

export const GET = localOnly(async (req) => {
  const table = new URL(req.url).searchParams.get("table") ?? "";
  try {
    return Response.json(await listColumns(table));
  } catch (err) {
    if (err instanceof InvalidTableError) {
      return Response.json({ error: { type: "InvalidTable", message: err.message } }, { status: 400 });
    }
    throw err;
  }
});
