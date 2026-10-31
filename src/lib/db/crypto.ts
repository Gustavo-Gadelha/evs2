import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { databaseUrl } from "./client";

// Cifra os segredos dos perfis (AES-256-GCM). A chave fica num arquivo ao lado do banco, fora do repositório:
// protege o `.db` copiado sozinho (backup, anexo), não quem lê o volume inteiro.
const KEY_FILE = "snk-assistant.key";

const globalForKey = globalThis as unknown as { snkKey?: Buffer };

function loadKey(): Buffer {
  const dbPath = resolve(databaseUrl().replace(/^file:/, ""));
  const keyPath = join(dirname(dbPath), KEY_FILE);

  try {
    return Buffer.from(readFileSync(keyPath, "utf8").trim(), "base64");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  const key = randomBytes(32);
  mkdirSync(dirname(keyPath), { recursive: true });
  try {
    // `wx`: se outra requisição criou a chave no meio-tempo, usa a dela em vez de sobrescrever.
    writeFileSync(keyPath, key.toString("base64"), { flag: "wx", mode: 0o600 });
    return key;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    return Buffer.from(readFileSync(keyPath, "utf8").trim(), "base64");
  }
}

function key(): Buffer {
  return (globalForKey.snkKey ??= loadKey());
}

// Formato: base64(iv[12] | tag[16] | texto cifrado).
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
