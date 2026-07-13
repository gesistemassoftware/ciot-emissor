import { randomUUID } from "crypto";
import { migrar, query } from "@/lib/db";
import type { CiotEmissaoInput, CiotEmissaoResult, CiotStatus } from "./types";

interface EmissaoRow {
  id: string;
  conta_id: string;
  status: CiotStatus;
  numero_ciot: string | null;
  codigo_verificador: string | null;
  protocolo_operadora: string | null;
  aviso_transportador: string | null;
  mensagem_erro: string | null;
  data_emissao: string;
  data_cancelamento: string | null;
  motivo_cancelamento: string | null;
  data_encerramento: string | null;
  input: CiotEmissaoInput;
}

function paraResultado(row: EmissaoRow): CiotEmissaoResult {
  return {
    id: row.id,
    status: row.status,
    numeroCiot: row.numero_ciot ?? undefined,
    codigoVerificador: row.codigo_verificador ?? undefined,
    protocoloOperadora: row.protocolo_operadora ?? undefined,
    avisoTransportador: row.aviso_transportador ?? undefined,
    mensagemErro: row.mensagem_erro ?? undefined,
    dataEmissao: row.data_emissao,
    dataCancelamento: row.data_cancelamento ?? undefined,
    motivoCancelamento: row.motivo_cancelamento ?? undefined,
    dataEncerramento: row.data_encerramento ?? undefined,
    input: row.input,
  };
}

export async function listarCiots(contaId: string): Promise<CiotEmissaoResult[]> {
  await migrar();
  const linhas = await query<EmissaoRow>(
    "SELECT * FROM emissoes WHERE conta_id = $1 ORDER BY data_emissao DESC",
    [contaId]
  );
  return linhas.map(paraResultado);
}

export async function buscarCiot(
  contaId: string,
  emissaoId: string
): Promise<CiotEmissaoResult | null> {
  await migrar();
  const linhas = await query<EmissaoRow>(
    "SELECT * FROM emissoes WHERE conta_id = $1 AND id = $2",
    [contaId, emissaoId]
  );
  return linhas[0] ? paraResultado(linhas[0]) : null;
}

export async function salvarCiot(
  contaId: string,
  resultado: Omit<CiotEmissaoResult, "id"> & { id?: string }
): Promise<CiotEmissaoResult> {
  await migrar();
  const id = resultado.id ?? randomUUID();

  await query(
    `INSERT INTO emissoes
       (id, conta_id, status, numero_ciot, codigo_verificador, protocolo_operadora,
        aviso_transportador, mensagem_erro, data_emissao, input)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      contaId,
      resultado.status,
      resultado.numeroCiot ?? null,
      resultado.codigoVerificador ?? null,
      resultado.protocoloOperadora ?? null,
      resultado.avisoTransportador ?? null,
      resultado.mensagemErro ?? null,
      resultado.dataEmissao,
      JSON.stringify(resultado.input),
    ]
  );

  return { ...resultado, id };
}

export async function cancelarCiotNoBanco(
  contaId: string,
  emissaoId: string,
  dataCancelamento: string,
  motivoCancelamento: string
): Promise<void> {
  await query(
    `UPDATE emissoes SET status = 'CANCELADO', data_cancelamento = $1, motivo_cancelamento = $2
     WHERE conta_id = $3 AND id = $4`,
    [dataCancelamento, motivoCancelamento, contaId, emissaoId]
  );
}

export async function encerrarCiotNoBanco(
  contaId: string,
  emissaoId: string,
  dataEncerramento: string
): Promise<void> {
  await query(
    `UPDATE emissoes SET status = 'ENCERRADO', data_encerramento = $1
     WHERE conta_id = $2 AND id = $3`,
    [dataEncerramento, contaId, emissaoId]
  );
}

export async function excluirCiotDoBanco(contaId: string, emissaoId: string): Promise<void> {
  await query("DELETE FROM emissoes WHERE conta_id = $1 AND id = $2", [contaId, emissaoId]);
}
