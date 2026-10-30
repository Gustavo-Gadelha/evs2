import { listTables } from "@/lib/sankhya/dictionary";
import { localOnly } from "@/lib/sankhya/route";

export const GET = localOnly(async () => Response.json(await listTables()));
