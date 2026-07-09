import https from "https";
import { randomUUID } from "crypto";
import type { CiotEmissaoInput, CiotStatus, Transportador } from "./types";

/**
 * Integração direta com o webservice PEF (Pagamento Eletrônico de Frete) da
 * ANTT — programa "CIOT Para Todos". Disponível apenas para ETC com frota
 * própria vinculada ao RNTRC.
 *
 * Fonte: Documento de Contrato de Serviço (DCS) PEF v1.1, disponível em
 * https://www.gov.br/antt/pt-br/assuntos/cargas/ciot-para-todos-1/documentos-tecnicos
 *
 * Autenticação: TLS 1.2 mútuo com certificado ICP-Brasil A1 ou A3 contendo o
 * CNPJ do titular (não há usuário/senha ou bearer token). Cada conta da
 * plataforma fornece o próprio certificado — é o CNPJ dele que a ANTT valida.
 *
 * O DCS informa textualmente que "no momento da implementação será
 * necessário solicitar à ANTT o host e contexto" — ou seja, os caminhos
 * exatos de cada serviço não são públicos. Os domínios abaixo são os únicos
 * citados no próprio DCS; confirme o path completo de cada serviço com a
 * ANTT durante o credenciamento antes de apontar para produção.
 */

export interface AnttCredenciais {
  baseUrl: string;
  pfx: Buffer;
  passphrase: string;
  transportador: Transportador;
}

interface DeclaracaoResponse {
  CodigoIdentificacaoOperacao?: string;
  CodigoVerificador?: string;
  Protocolo?: string;
  Codigo?: string;
  Mensagem?: string;
  AvisoTransportador?: string;
}

function postJson<T>(
  credenciais: AnttCredenciais,
  servico: string,
  body: unknown
): Promise<{ status: number; body: T }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(`${credenciais.baseUrl}/${servico}`);

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        pfx: credenciais.pfx,
        passphrase: credenciais.passphrase,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data || "{}") });
          } catch {
            reject(new Error(`Resposta inválida da ANTT: ${data.slice(0, 300)}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function montarPayloadDeclaracao(input: CiotEmissaoInput, transportador: Transportador) {
  return {
    IdOperacaoTransporte: randomUUID().replace(/-/g, "").slice(0, 12),
    TipoOperacao: input.operacao.tipoOperacao,
    CpfCnpjContratado: transportador.cpfCnpj.replace(/\D/g, ""),
    RNTRCContratado: transportador.rntrc,
    CpfCnpjContratante: input.contratante.cnpj.replace(/\D/g, ""),
    CpfCnpjDestinatario: input.operacao.cpfCnpjDestinatario?.replace(/\D/g, "") || undefined,
    ValorFrete: input.operacao.valorFrete,
    DataDeclaracao: new Date().toISOString(),
    IndContingencia: input.operacao.indContingencia,
    JustificativaContingencia: input.operacao.justificativaContingencia,
    DataInicioViagem: input.operacao.dataInicioViagem,
    DataFimViagem: input.operacao.dataFimViagem,
    Veiculos: [
      {
        Placa: input.veiculo.placa.toUpperCase(),
        RNTRC: input.veiculo.rntrc,
        NumeroEixos: input.veiculo.numeroEixos,
      },
    ],
    OrigemDestino: [
      {
        Origem: { CodigoMunicipioOrigem: input.operacao.codigoMunicipioOrigem },
        Destino: { CodigoMunicipioDestino: input.operacao.codigoMunicipioDestino },
        DistanciaPercorrida: input.operacao.distanciaPercorridaKm,
      },
    ],
    DadosCarga: {
      CodigoNaturezaCarga: input.operacao.codigoNaturezaCarga,
      PesoCarga: input.operacao.pesoCargaKg,
      CodigoTipoCarga: input.operacao.codigoTipoCarga,
    },
    InfPagamento: [
      {
        TipoPagamento: input.pagamento.tipoPagamento,
        CodigoInstituicaoFinanceira: input.pagamento.codigoInstituicaoFinanceira,
        NumeroAgencia: input.pagamento.numeroAgencia,
        NumeroConta: input.pagamento.numeroConta,
        ChavePix: input.pagamento.chavePix,
        CpfCnpjCreditado: input.pagamento.cpfCnpjCreditado,
        IndPagamento: input.pagamento.indPagamento,
        NumeroParcela: input.pagamento.numeroParcela,
        DataVencimento: input.pagamento.dataVencimento,
        ValorParcela: input.pagamento.valorParcela,
      },
    ],
    InfIndicadoresOperacionais: {
      IndAltoDesempenho: input.operacao.indAltoDesempenho,
      IndRetornoVazio: input.operacao.indRetornoVazio,
      ComposicaoVeicular: input.operacao.composicaoVeicular,
    },
  };
}

export async function emitirCiotAntt(
  input: CiotEmissaoInput,
  credenciais: AnttCredenciais
): Promise<{
  status: CiotStatus;
  numeroCiot?: string;
  codigoVerificador?: string;
  protocoloOperadora?: string;
  avisoTransportador?: string;
  mensagemErro?: string;
  dataEmissao: string;
}> {
  const payload = montarPayloadDeclaracao(input, credenciais.transportador);
  const { status, body } = await postJson<DeclaracaoResponse>(
    credenciais,
    "DeclaracaoOperacaoTransporte",
    payload
  );

  if (status < 200 || status >= 300 || !body.CodigoIdentificacaoOperacao) {
    return {
      status: "ERRO",
      mensagemErro: body.Mensagem ?? `Erro HTTP ${status} na ANTT.`,
      dataEmissao: new Date().toISOString(),
    };
  }

  return {
    status: "EMITIDO",
    numeroCiot: body.CodigoIdentificacaoOperacao,
    codigoVerificador: body.CodigoVerificador,
    protocoloOperadora: body.Protocolo,
    avisoTransportador: body.AvisoTransportador,
    dataEmissao: new Date().toISOString(),
  };
}
