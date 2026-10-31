// Cria ou atualiza o perfil padrão do Sankhya a partir das variáveis SANKHYA_PROFILE_* do `.env` (`pnpm seed`).
// Etapa opcional: sem nenhuma das variáveis, não faz nada. Roda no host, contra o Postgres do compose (DATABASE_URL).
// Reimplementa em JS o formato de `src/lib/db/crypto.ts` e as regras de `src/features/profiles/server/profiles.ts`
// porque o script roda no Node puro, sem os aliases `@/` nem o `server-only` do Next: mantenha os três em sincronia.

import { createCipheriv, randomBytes, randomUUID } from "node:crypto";

import pg from "pg";

try {
  process.loadEnvFile();
} catch {}

const FIELDS = {
  name: "SANKHYA_PROFILE_NAME",
  baseUrl: "SANKHYA_PROFILE_BASE_URL",
  appkey: "SANKHYA_PROFILE_APPKEY",
  token: "SANKHYA_PROFILE_TOKEN",
  username: "SANKHYA_PROFILE_USERNAME",
  password: "SANKHYA_PROFILE_PASSWORD",
};

const fail = (message) => {
  console.error(`seed: ${message}`);
  process.exit(1);
};

// Variável vazia conta como não definida.
const given = Object.entries(FIELDS).filter(([, variable]) => process.env[variable]);
if (given.length === 0) {
  console.log("seed: nenhuma variável SANKHYA_PROFILE_* definida; nada a fazer.");
  process.exit(0);
}
const missing = Object.values(FIELDS).filter((variable) => !process.env[variable]);
if (missing.length > 0) fail(`defina também: ${missing.join(", ")} (ou remova todas as SANKHYA_PROFILE_*).`);

// Mesmas regras das rotas de perfil: textos aparados (a senha não), até 500 caracteres, nome até 100, URL http(s).
const text = (field, max = 500) => {
  const value = process.env[FIELDS[field]].trim();
  if (!value || value.length > max) fail(`${FIELDS[field]} deve ter de 1 a ${max} caracteres.`);
  return value;
};
const name = text("name", 100);
const baseUrl = text("baseUrl");
const appkey = text("appkey");
const token = text("token");
const username = text("username");
const password = process.env[FIELDS.password];
if (password.length > 500) fail(`${FIELDS.password} deve ter até 500 caracteres.`);
try {
  if (!/^https?:$/.test(new URL(baseUrl).protocol)) throw new Error();
} catch {
  fail(`${FIELDS.baseUrl} deve ser uma URL http(s).`);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL não definida (copie .env.example para .env).");
const key = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
if (key.length !== 32) fail("ENCRYPTION_KEY deve ter 32 bytes em base64 (ver .env.example).");

// Formato: base64(iv[12] | tag[16] | texto cifrado), AES-256-GCM.
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const data = Buffer.concat([
  cipher.update(JSON.stringify({ appkey, token, username, password }), "utf8"),
  cipher.final(),
]);
const secret = Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");

const client = new pg.Client({ connectionString: databaseUrl });
try {
  await client.connect();
  const { rows } = await client.query(
    `INSERT INTO "Profile" (id, name, "baseUrl", secret) VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE SET "baseUrl" = EXCLUDED."baseUrl", secret = EXCLUDED.secret
     RETURNING id, (xmax = 0) AS created`,
    [randomUUID(), name, baseUrl, secret],
  );
  const { id, created } = rows[0];
  // Como no cadastro pela tela: só vira o perfil ativo se ainda não houver um ativo válido.
  const active = await client.query(
    `INSERT INTO "AppSetting" (key, value)
     SELECT 'activeProfileId', $1
     WHERE NOT EXISTS (
       SELECT 1 FROM "AppSetting" s JOIN "Profile" p ON p.id = s.value WHERE s.key = 'activeProfileId'
     )
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [id],
  );
  console.log(
    `seed: perfil "${name}" ${created ? "criado" : "atualizado"}${active.rowCount ? " e definido como ativo" : ""}.`,
  );
  console.log("seed: se o app já estiver rodando, reinicie-o para ele recarregar os perfis.");
} catch (err) {
  fail(
    err.code === "42P01"
      ? "tabelas não encontradas; suba o app uma vez para aplicar as migrations."
      : (err.message ?? String(err)),
  );
} finally {
  await client.end().catch(() => {});
}
