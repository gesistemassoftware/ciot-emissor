import https from "https";
import { gerarIdOperacaoTransporte } from "./geradorCiotBridge";
import type { CiotEmissaoInput, CiotStatus } from "./types";

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
 * O Contratado (quem efetivamente dirige/recebe pelo frete) é informado por
 * operação, não vem do certificado: a transportadora pode subcontratar
 * motoristas/veículos diferentes a cada emissão (ex: TAC-Agregado).
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

/**
 * DCS PEF v1.1 exige "yyyy-MM-ddTHH:mm:ss" no horário de Brasília (regra
 * B11: tolerância de só 15 min antes a 5 min depois da data/hora atual,
 * "considerando o horário oficial de Brasília"). O Brasil não observa mais
 * horário de verão, então o offset é fixo em UTC-3.
 */
function dataDeclaracaoBrasilia(): string {
  const agoraBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return agoraBrasilia.toISOString().slice(0, 19);
}

/**
 * DCS PEF v1.1: placa no padrão brasileiro (AAA9999) ou Mercosul (AAA9A99),
 * sem traço — remove qualquer caractere que não seja letra/número, já que
 * o formulário aceita o usuário digitar com traço (ex: "MNR-1A80").
 */
function normalizarPlaca(placa: string): string {
  return placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * DCS PEF v1.1 (regra B60 — "Normalização do RNTRC"): só dígitos; com 8
 * dígitos completa com zero à esquerda até 9, com 9 mantém como está.
 * O formulário aceita o usuário digitar com prefixo/traço (ex:
 * "RNTRC-1234567"), então limpamos antes de enviar.
 *
 * Quando vazio (ex: "RNTRC do veículo" em branco, por ser igual ao do
 * contratado), retorna undefined para o campo ser omitido do JSON —
 * mandar "" foi rejeitado pela ANTT como se o veículo não tivesse
 * vínculo com o transportador contratado (regra B20).
 */
function normalizarRntrc(rntrc: string | undefined): string | undefined {
  if (!rntrc) return undefined;
  const digitos = rntrc.replace(/\D/g, "");
  if (!digitos) return undefined;
  if (digitos.length === 8) return `0${digitos}`;
  return digitos;
}

async function montarPayloadDeclaracao(input: CiotEmissaoInput) {
  return {
    IdOperacaoTransporte: await gerarIdOperacaoTransporte(input.contratado.cpfCnpj),
    TipoOperacao: input.operacao.tipoOperacao,
    CpfCnpjContratado: input.contratado.cpfCnpj.replace(/\D/g, ""),
    RNTRCContratado: normalizarRntrc(input.contratado.rntrc),
    CpfCnpjContratante: input.contratante.cnpj.replace(/\D/g, ""),
    CpfCnpjDestinatario: input.destinatario.cpfCnpj.replace(/\D/g, "") || undefined,
    ValorFrete: input.operacao.valorFrete,
    DataDeclaracao: dataDeclaracaoBrasilia(),
    IndContingencia: input.operacao.indContingencia,
    JustificativaContingencia: input.operacao.justificativaContingencia,
    DataInicioViagem: input.operacao.dataInicioViagem,
    DataFimViagem: input.operacao.dataFimViagem,
    Veiculos: [
      {
        Placa: normalizarPlaca(input.veiculo.placa),
        RNTRC: normalizarRntrc(input.veiculo.rntrc),
        NumeroEixos: input.veiculo.numeroEixos,
      },
      ...(input.operacao.composicaoVeicular && input.implementos
        ? input.implementos.map((implemento) => ({
            Placa: normalizarPlaca(implemento.placa),
            RNTRC: normalizarRntrc(implemento.rntrc),
            NumeroEixos: implemento.numeroEixos,
          }))
        : []),
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
      ContratantesCargaFrac:
        input.operacao.tipoOperacao === 2
          ? input.operacao.contratantesCargaFrac?.map((cpfCnpj) => cpfCnpj.replace(/\D/g, ""))
          : undefined,
    },
    InfPagamento: [
      {
        TipoPagamento: input.pagamento.tipoPagamento,
        CodigoInstituicaoFinanceira: input.pagamento.codigoInstituicaoFinanceira,
        NumeroAgencia: input.pagamento.numeroAgencia,
        NumeroConta: input.pagamento.numeroConta,
        ChavePix: input.pagamento.chavePix,
        CpfCnpjCreditado: input.pagamento.cpfCnpjCreditado,
        CodigoPagamento: input.pagamento.codigoPagamento,
        IdentificadorPix: input.pagamento.identificadorPix,
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

interface CancelamentoResponse {
  CodigoIdentificacaoOperacao?: string;
  DataCancelamento?: string;
  Protocolo?: string;
  Codigo?: string;
  Mensagem?: string;
}

interface EncerramentoResponse {
  CodigoIdentificacaoOperacao?: string;
  DataEncerramento?: string;
  Protocolo?: string;
  Codigo?: string;
  Mensagem?: string;
}

interface ConsultaCiotResponse {
  CodigoIdentificacaoOperacao?: string;
  Codigo?: string;
  Mensagem?: string;
}

interface ConsultaFrotaResponse {
  CpfCnpjTransportador?: string;
  RNTRCTransportador?: string;
  NomeRazaoSocialTransportador?: string;
  RNTRCAtivo?: boolean;
  Mensagem?: string;
  Protocolo?: string;
  Codigo?: string;
  Frota?: { PlacaVeiculo: string; SituacaoVeiculoFrotaTransportador: boolean | number }[];
}

/**
 * Serviço ConsultarFrotaTransportador (DCS PEF v1.1) — verifica, antes de
 * declarar, se uma placa realmente "pertence" ao transportador no cadastro
 * da ANTT. Útil para diagnosticar rejeições de vínculo veículo/contratado
 * (regra B20 da Declaração) sem precisar tentar emitir de verdade.
 */
export async function consultarFrotaTransportador(
  cpfCnpjTransportador: string,
  rntrcTransportador: string,
  placas: string[],
  credenciais: AnttCredenciais
): Promise<{
  rntrcAtivo: boolean;
  nomeRazaoSocial?: string;
  frota: { placa: string; pertence: boolean }[];
  mensagemErro?: string;
}> {
  let status: number;
  let body: ConsultaFrotaResponse;
  try {
    ({ status, body } = await postJson<ConsultaFrotaResponse>(
      credenciais,
      "ConsultarFrotaTransportador",
      {
        CpfCnpjInteressado: cpfCnpjTransportador.replace(/\D/g, ""),
        CpfCnpjTransportador: cpfCnpjTransportador.replace(/\D/g, ""),
        RNTRCTransportador: normalizarRntrc(rntrcTransportador),
        Placas: placas.map(normalizarPlaca),
      }
    ));
  } catch (error) {
    return {
      rntrcAtivo: false,
      frota: [],
      mensagemErro: error instanceof Error ? error.message : "Falha ao comunicar com a ANTT.",
    };
  }

  if (status < 200 || status >= 300) {
    return {
      rntrcAtivo: false,
      frota: [],
      mensagemErro: body.Mensagem ?? `Erro HTTP ${status} na ANTT.`,
    };
  }

  return {
    rntrcAtivo: !!body.RNTRCAtivo,
    nomeRazaoSocial: body.NomeRazaoSocialTransportador,
    frota: (body.Frota ?? []).map((v) => ({
      placa: v.PlacaVeiculo,
      pertence: v.SituacaoVeiculoFrotaTransportador === true || v.SituacaoVeiculoFrotaTransportador === 1,
    })),
    // body.Mensagem no sucesso costuma ser só uma confirmação genérica da
    // ANTT ("Consulta realizada com sucesso!"), não um erro — por isso não
    // entra em mensagemErro aqui (só nos dois retornos de erro acima).
  };
}

/**
 * Cancelamento e Encerramento usam o CIOT concatenado com o Código
 * Verificador (16 caracteres = 12 do CIOT + 4 do verificador) — diferente da
 * Declaração, que retorna os dois campos separados (DCS PEF v1.1).
 */
function codigoComVerificador(numeroCiot: string, codigoVerificador: string): string {
  return `${numeroCiot}${codigoVerificador}`;
}

export async function cancelarCiotAntt(
  numeroCiot: string,
  codigoVerificador: string,
  motivoCancelamento: string,
  credenciais: AnttCredenciais
): Promise<{
  ok: boolean;
  dataCancelamento?: string;
  protocolo?: string;
  mensagemErro?: string;
}> {
  const { status, body } = await postJson<CancelamentoResponse>(
    credenciais,
    "CancelamentoOperacaoTransporte",
    {
      CodigoIdentificacaoOperacao: codigoComVerificador(numeroCiot, codigoVerificador),
      MotivoCancelamento: motivoCancelamento,
    }
  );

  if (status < 200 || status >= 300 || !body.DataCancelamento) {
    return { ok: false, mensagemErro: body.Mensagem ?? `Erro HTTP ${status} na ANTT.` };
  }

  return { ok: true, dataCancelamento: body.DataCancelamento, protocolo: body.Protocolo };
}

export async function encerrarCiotAntt(
  numeroCiot: string,
  codigoVerificador: string,
  credenciais: AnttCredenciais
): Promise<{
  ok: boolean;
  dataEncerramento?: string;
  protocolo?: string;
  mensagemErro?: string;
}> {
  const { status, body } = await postJson<EncerramentoResponse>(
    credenciais,
    "EncerramentoOperacaoTransporte",
    { CodigoIdentificacaoOperacao: codigoComVerificador(numeroCiot, codigoVerificador) }
  );

  if (status < 200 || status >= 300 || !body.DataEncerramento) {
    return { ok: false, mensagemErro: body.Mensagem ?? `Erro HTTP ${status} na ANTT.` };
  }

  return { ok: true, dataEncerramento: body.DataEncerramento, protocolo: body.Protocolo };
}

export async function consultarCiotGeradoAntt(
  numeroCiot: string,
  anoDeclaracao: number,
  credenciais: AnttCredenciais
): Promise<{ existe: boolean; mensagem?: string }> {
  const { status, body } = await postJson<ConsultaCiotResponse>(
    credenciais,
    "ConsultarCIOTGerado",
    { CodigoIdentificacaoOperacao: numeroCiot, AnoDeclaracao: anoDeclaracao }
  );

  return {
    existe: status >= 200 && status < 300 && !!body.CodigoIdentificacaoOperacao,
    mensagem: body.Mensagem,
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
  const payload = await montarPayloadDeclaracao(input);
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
