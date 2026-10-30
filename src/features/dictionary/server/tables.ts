import "server-only";

import { listTables } from "./dictionary";
import { localOnly } from "@/features/sankhya/server/local-only";

export const GET = localOnly(async () => Response.json(await listTables()));
