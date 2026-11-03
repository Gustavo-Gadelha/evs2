// Base de `pnpm ai:pull-chat` e `pnpm ai:pull-embed`: baixa um modelo executando `ollama pull` dentro do container
// `ollama` do compose (o serviço precisa estar no ar: `docker compose up -d ollama`). Roda no host e lê o `.env`.
// Os padrões espelham PRESETS em src/features/assistant/server/config.ts (aqui não dá para importar o .ts).

import { spawnSync } from "node:child_process";

try {
  process.loadEnvFile();
} catch {}

const DEFAULTS = {
  chat: { gpu: "qwen3:8b", cpu: "qwen3:4b" },
  embed: { gpu: "bge-m3", cpu: "bge-m3" },
};

export function pullModel(kind) {
  const label = `ai:pull-${kind}`;
  const preset = process.env.AI_PRESET || "gpu";
  if (!(preset in DEFAULTS[kind])) {
    console.error(`${label}: AI_PRESET inválido ("${preset}"); use gpu ou cpu.`);
    process.exit(1);
  }
  const override = kind === "chat" ? process.env.AI_CHAT_MODEL : process.env.AI_EMBED_MODEL;
  const model = override?.trim() || DEFAULTS[kind][preset];

  console.log(`${label}: baixando ${model} (preset ${preset}) no container ollama...`);
  const result = spawnSync("docker", ["compose", "exec", "ollama", "ollama", "pull", model], { stdio: "inherit" });
  if (result.error) {
    console.error(`${label}: não executou o docker (${result.error.code ?? result.error.message}).`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${label}: falhou. O serviço está no ar? Rode: docker compose up -d ollama`);
    process.exit(result.status ?? 1);
  }
}
