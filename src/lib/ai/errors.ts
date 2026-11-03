// Erros do assistente de IA. Têm `httpStatus` como os do Sankhya e são mapeados por `errorResponse`.
// O `name` é escrito à mão: o nome da classe é minificado no build de produção e iria vazio para o navegador.
export class AiError extends Error {
  readonly httpStatus: number = 502;
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

// Ollama fora do ar ou modelo não baixado.
export class AiUnavailableError extends AiError {
  override readonly name = "AiUnavailableError";
  override readonly httpStatus = 503;
}

export class AiTimeoutError extends AiError {
  override readonly name = "AiTimeoutError";
  override readonly httpStatus = 504;
}

// Ainda não há índice do dicionário para este ERP.
export class AiIndexMissingError extends AiError {
  override readonly name = "AiIndexMissingError";
  override readonly httpStatus = 409;
}

// O índice foi gerado com outro modelo de embeddings: misturar vetores daria resultado sem sentido.
export class AiIndexMismatchError extends AiError {
  override readonly name = "AiIndexMismatchError";
  override readonly httpStatus = 409;
}

export class AiIndexBusyError extends AiError {
  override readonly name = "AiIndexBusyError";
  override readonly httpStatus = 409;
}
