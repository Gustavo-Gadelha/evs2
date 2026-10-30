import { z } from "zod";

// Sem `server-only`: este módulo também é importado por `instrumentation.ts`, fora do grafo de
// React Server Components. As credenciais continuam só no servidor porque nenhuma usa `NEXT_PUBLIC_`.
const envSchema = z.object({
  SANKHYA_BASE_URL: z.url({ protocol: /^https?$/ }),
  SANKHYA_APPKEY: z.string().min(1),
  SANKHYA_TOKEN: z.string().min(1),
  SANKHYA_USERNAME: z.string().min(1),
  SANKHYA_PASSWORD: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(
      `Variáveis do Sankhya ausentes ou inválidas: ${missing}. ` +
        "Copie .env.example para .env.local, preencha os valores e rode `docker compose up` de novo.",
    );
  }

  cached = result.data;
  return cached;
}
