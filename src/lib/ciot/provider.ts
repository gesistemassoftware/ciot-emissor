import { emitirCiotAntt, type AnttCredenciais } from "./anttClient";
import type { CiotEmissaoInput, CiotEmissaoResult } from "./types";

function gerarNumeroCiotMock() {
  const parte = () => Math.floor(Math.random() * 900000 + 100000);
  return `${parte()}${parte()}`;
}

/**
 * credenciais é `null` quando a conta ainda não cadastrou um certificado —
 * nesse caso a emissão roda em modo simulado, para permitir testar o fluxo
 * antes de ter o certificado ICP-Brasil em mãos.
 */
export async function emitirCiot(
  input: CiotEmissaoInput,
  credenciais: AnttCredenciais | null
): Promise<Omit<CiotEmissaoResult, "id" | "input">> {
  if (!credenciais) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return {
      status: "EMITIDO",
      numeroCiot: gerarNumeroCiotMock(),
      codigoVerificador: String(Math.floor(Math.random() * 9000 + 1000)),
      protocoloOperadora: `MOCK-${Date.now()}`,
      dataEmissao: new Date().toISOString(),
      mensagemErro:
        "Emitido em modo simulado — cadastre o certificado ANTT em Configurações para emitir de verdade.",
    };
  }

  try {
    return await emitirCiotAntt(input, credenciais);
  } catch (error) {
    return {
      status: "ERRO",
      mensagemErro:
        error instanceof Error ? error.message : "Falha ao comunicar com a ANTT.",
      dataEmissao: new Date().toISOString(),
    };
  }
}
