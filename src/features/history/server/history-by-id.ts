import "server-only";

import { getHistory } from "./store";
import { localOnly } from "@/features/sankhya/server/local-only";

export const GET = localOnly(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const entry = await getHistory((await params).id);
  if (!entry) return Response.json({ error: { type: "NotFound", message: "Entrada não encontrada." } }, { status: 404 });
  return Response.json(entry);
});
