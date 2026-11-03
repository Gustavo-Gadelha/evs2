// Baixa o modelo de embeddings do preset (`pnpm ai:pull-embed`), executando `ollama pull` no container `ollama`.

import { pullModel } from "./ai-pull-lib.mjs";

pullModel("embed");
