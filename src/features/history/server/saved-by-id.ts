import "server-only";

import { removeSaved } from "./store";
import { localOnly } from "@/features/sankhya/server/local-only";

export const DELETE = localOnly(async (_req, { params }: { params: Promise<{ id: string }> }) =>
  Response.json(await removeSaved((await params).id)),
);
