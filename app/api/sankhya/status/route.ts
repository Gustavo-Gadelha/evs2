import { getAuthStatus } from "@/lib/sankhya/auth";
import { localOnly } from "@/lib/sankhya/route";
import type { AuthStatus } from "@/lib/types";

export const GET = localOnly(async () => Response.json(getAuthStatus() satisfies AuthStatus));
