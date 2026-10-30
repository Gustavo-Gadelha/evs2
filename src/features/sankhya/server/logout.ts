import "server-only";

import { logout } from "./auth";
import { localOnly } from "./local-only";

export const POST = localOnly(async () => {
  await logout();
  return Response.json({ ok: true });
});
