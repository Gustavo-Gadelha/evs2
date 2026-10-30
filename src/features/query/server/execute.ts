import "server-only";

import type { QueryResult } from "@/lib/types";
import { request } from "@/features/sankhya/server/client";
import { SankhyaClientError, SankhyaQueryError } from "@/features/sankhya/server/errors";

const SERVICE = "DbExplorerSP.executeQuery";

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function statusMessage(body: unknown): string | undefined {
  return isObj(body) && typeof body.statusMessage === "string" && body.statusMessage ? body.statusMessage : undefined;
}

// Colunas na ordem de `order`, linhas como o Sankhya devolve (mesma regra do parse_query_result do Python).
function parse(body: Obj): Pick<QueryResult, "columns" | "rows"> {
  const responseBody = isObj(body.responseBody) ? body.responseBody : {};
  const fields = Array.isArray(responseBody.fieldsMetadata) ? responseBody.fieldsMetadata.filter(isObj) : [];
  const rows = Array.isArray(responseBody.rows) ? responseBody.rows.filter(Array.isArray) : [];

  const columns = fields
    .map((field, index) => ({ name: String(field.name ?? `COL${index + 1}`), order: Number(field.order ?? index) }))
    .sort((a, b) => a.order - b.order)
    .map((field) => field.name);

  return { columns, rows };
}

export async function executeQuery(sql: string): Promise<QueryResult> {
  let response;
  try {
    response = await request("POST", "gateway/v1/mge/service.sbr", {
      query: { serviceName: SERVICE, outputType: "json" },
      body: { serviceName: SERVICE, requestBody: { sql } },
    });
  } catch (err) {
    // Não 2xx com mensagem do Sankhya: mostra a mensagem em vez de só o status HTTP.
    const message = err instanceof SankhyaClientError ? statusMessage(err.response?.body) : undefined;
    if (message) throw new SankhyaQueryError(message, { cause: err });
    throw err;
  }

  const { body, durationMs } = response;
  if (!isObj(body)) throw new SankhyaClientError("O Sankhya devolveu uma resposta que não é JSON.");

  // O gateway responde 200 mesmo quando a consulta falha; o resultado real vem em `status`.
  if (body.status !== "1") throw new SankhyaQueryError(statusMessage(body));

  return { ...parse(body), durationMs, raw: body };
}
