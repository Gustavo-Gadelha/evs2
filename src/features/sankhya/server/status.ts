import "server-only";

import { getAuthStatus } from "./auth";
import { localOnly } from "./local-only";
import type { AuthStatus } from "@/lib/types";

export const GET = localOnly(async () => Response.json(getAuthStatus() satisfies AuthStatus));
