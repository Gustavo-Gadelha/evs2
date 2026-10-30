import { removeSaved } from "@/lib/db/store";
import { localOnly } from "@/lib/sankhya/route";

export const DELETE = localOnly(async (_req, { params }: { params: Promise<{ id: string }> }) =>
  Response.json(await removeSaved((await params).id)),
);
