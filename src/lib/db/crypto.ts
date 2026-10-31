import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifra os segredos dos perfis (AES-256-GCM). A chave (32 bytes em base64) vem de `ENCRYPTION_KEY` no `.env`,
// fora do banco e do repositório: protege um dump do Postgres copiado sozinho, não quem lê o `.env`.
// Gere uma com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Trocá-la invalida os perfis salvos.
const globalForKey = globalThis as unknown as { snkKey?: Buffer };

function loadKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY não definida (ver .env.example).");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY deve ter 32 bytes em base64.");
  return key;
}

function key(): Buffer {
  return (globalForKey.snkKey ??= loadKey());
}

// Formato: base64(iv[12] | tag[16] | texto cifrado). `scripts/seed-profile.mjs` reimplementa o mesmo formato.
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
