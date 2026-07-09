import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buscarConta, obterCertificado } from "@/lib/auth/contas";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { emitirCiot } from "@/lib/ciot/provider";
import { listarCiots, salvarCiot } from "@/lib/ciot/store";
import type { AnttCredenciais } from "@/lib/ciot/anttClient";
import type { CiotEmissaoInput } from "@/lib/ciot/types";

const ANTT_BASE_URL_HML = "https://appservices-hml.antt.gov.br/pefServices";
const ANTT_BASE_URL_PROD = "https://appservices.antt.gov.br/pefServices";

function validar(input: Partial<CiotEmissaoInput>): string | null {
  if (!input.contratante?.cnpj) return "CNPJ/CPF do contratante é obrigatório.";
  if (!input.veiculo?.placa) return "Placa do veículo é obrigatória.";
  if (!input.veiculo?.numeroEixos) return "Número de eixos do veículo é obrigatório.";
  if (!input.operacao?.tipoOperacao) return "Tipo de operação é obrigatório.";
  if (!input.operacao?.codigoMunicipioOrigem || !input.operacao?.codigoMunicipioDestino)
    return "Código IBGE do município de origem e de destino são obrigatórios.";
  if (!input.operacao?.dataInicioViagem || !input.operacao?.dataFimViagem)
    return "Data de início e fim da viagem são obrigatórias.";
  if (!input.operacao?.codigoNaturezaCarga) return "Código da natureza da carga é obrigatório.";
  if (!input.operacao?.codigoTipoCarga) return "Código do tipo de carga é obrigatório.";
  if (!input.operacao?.valorFrete || input.operacao.valorFrete <= 0)
    return "Valor do frete deve ser maior que zero.";
  if (input.operacao?.indContingencia && !input.operacao?.justificativaContingencia)
    return "Justificativa de contingência é obrigatória quando a emissão é em contingência.";
  if (!input.pagamento?.tipoPagamento) return "Tipo de pagamento é obrigatório.";
  return null;
}

export async function GET() {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const registros = await listarCiots(contaId);
  return NextResponse.json(registros);
}

export async function POST(request: NextRequest) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const conta = await buscarConta(contaId);
  if (!conta) {
    return NextResponse.json({ mensagem: "Conta não encontrada." }, { status: 404 });
  }

  const body = (await request.json()) as CiotEmissaoInput;

  const erro = validar(body);
  if (erro) {
    return NextResponse.json({ mensagem: erro }, { status: 400 });
  }

  let credenciais: AnttCredenciais | null = null;
  if (conta.certificadoConfigurado) {
    const certificado = await obterCertificado(contaId);
    if (certificado) {
      credenciais = {
        baseUrl: conta.anttAmbiente === "producao" ? ANTT_BASE_URL_PROD : ANTT_BASE_URL_HML,
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        transportador: { tipo: conta.tipoTransportador, cpfCnpj: conta.cnpj, rntrc: conta.rntrc },
      };
    }
  }

  const resultado = await emitirCiot(body, credenciais);

  const registro = await salvarCiot(contaId, {
    id: randomUUID(),
    input: body,
    ...resultado,
  });

  return NextResponse.json(registro, {
    status: registro.status === "ERRO" ? 502 : 201,
  });
}
