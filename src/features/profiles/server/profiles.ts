import "server-only";

import { z } from "zod";

import { createProfile, DuplicateProfileError, listProfiles, ProfileNotFoundError } from "./store";
import { localOnly } from "@/features/sankhya/server/local-only";

const text = z.string().trim().min(1).max(500);

export const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  baseUrl: z.url({ protocol: /^https?$/ }),
  appkey: text,
  token: text,
  username: text,
  password: z.string().min(1).max(500),
});

// Na edição, segredos em branco mantêm o valor guardado.
export const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  baseUrl: z.url({ protocol: /^https?$/ }).optional(),
  appkey: z.string().trim().max(500).optional(),
  token: z.string().trim().max(500).optional(),
  username: z.string().trim().max(500).optional(),
  password: z.string().max(500).optional(),
});

export function invalid(message: string, status = 400): Response {
  return Response.json({ error: { type: "InvalidRequest", message } }, { status });
}

// Erros de domínio dos perfis viram 4xx; o resto cai no `errorResponse` do `localOnly`.
export async function guard(action: () => Promise<Response>): Promise<Response> {
  try {
    return await action();
  } catch (err) {
    if (err instanceof DuplicateProfileError) return invalid(err.message, 409);
    if (err instanceof ProfileNotFoundError) return invalid(err.message, 404);
    throw err;
  }
}

export const GET = localOnly(async () => Response.json(await listProfiles()));

export const POST = localOnly(async (req) =>
  guard(async () => {
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return invalid(z.prettifyError(parsed.error));
    await createProfile(parsed.data);
    return Response.json(await listProfiles());
  }),
);
