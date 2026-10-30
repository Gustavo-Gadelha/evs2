export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Falha na subida do servidor, e não só na primeira requisição, se faltar alguma credencial.
  const { getEnv } = await import("@/lib/env");
  getEnv();
}
