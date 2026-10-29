import { logout } from "@/lib/sankhya/auth";
import { localOnly } from "@/lib/sankhya/route";

export const POST = localOnly(async () => {
  await logout();
  return Response.json({ ok: true });
});
