import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { obterCredenciaisAntt } from "@/lib/ciot/credenciais";
import { emitirCiot } from "@/lib/ciot/provider";
import { listarCiots, salvarCiot } from "@/lib/ciot/store";
import { salvarTerceiro } from "@/lib/ciot/terceiros";
import type { CiotEmissaoInput, Terceiro } from "@/lib/ciot/types";

function validarTerceiro(t: Partial<Terceiro> | undefined, label: string): string | null {
  if (!t?.cpfCnpj) return `CPF/CNPJ do ${label} é obrigatório.`;
  if (!t?.nomeRazaoSocial) return `Nome/razão social do ${label} é obrigatório.`;
  if (!t?.endereco?.rua || !t?.endereco?.numero || !t?.endereco?.bairro || !t?.endereco?.cep || !t?.endereco?.municipio || !t?.endereco?.uf)
    return `Endereço completo do ${label} é obrigatório.`;
  return null;
}

function validar(input: Partial<CiotEmissaoInput>): string | null {
  if (!input.contratante?.cnpj) return "CNPJ/CPF do contratante é obrigatório.";

  const erroContratado = validarTerceiro(input.contratado, "contratado");
  if (erroContratado) return erroContratado;
  if (!input.contratado?.rntrc) return "RNTRC do contratado é obrigatório.";

  const erroDestinatario = validarTerceiro(input.destinatario, "destinatário");
  if (erroDestinatario) return erroDestinatario;

  const erroTomador = validarTerceiro(input.tomador, "tomador do serviço");
  if (erroTomador) return erroTomador;

  if (!input.veiculo?.placa) return "Placa do veículo é obrigatória.";
  if (!input.veiculo?.numeroEixos) return "Número de eixos do veículo é obrigatório.";
  if (input.operacao?.composicaoVeicular) {
    if (!input.implementos || input.implementos.length === 0)
      return "Informe ao menos um implemento quando há composição veicular.";
    if (input.implementos.length > 4)
      return "A ANTT aceita no máximo 5 placas por operação (veículo + até 4 implementos).";
    for (const implemento of input.implementos) {
      if (!implemento.placa) return "Placa do implemento é obrigatória.";
      if (!implemento.numeroEixos) return "Número de eixos do implemento é obrigatório.";
    }
  }
  if (!input.operacao?.tipoOperacao) return "Tipo de operação é obrigatório.";
  if (
    input.operacao?.tipoOperacao === 2 &&
    (!input.operacao?.contratantesCargaFrac || input.operacao.contratantesCargaFrac.length === 0)
  )
    return "Informe ao menos um contratante da carga fracionada (obrigatório para Carga Fracionada).";
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
  if (input.pagamento?.tipoPagamento === 6 && !input.pagamento?.identificadorPix)
    return "Identificador Pix é obrigatório quando o pagamento é via Pix.";
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

  const body = (await request.json()) as CiotEmissaoInput;

  const erro = validar(body);
  if (erro) {
    return NextResponse.json({ mensagem: erro }, { status: 400 });
  }

  // Salva/atualiza os cadastros para reuso nas próximas emissões, independente
  // do resultado da declaração junto à ANTT.
  await Promise.all([
    salvarTerceiro(contaId, "contratado", body.contratado),
    salvarTerceiro(contaId, "destinatario", body.destinatario),
    salvarTerceiro(contaId, "tomador", body.tomador),
  ]);

  const credenciais = await obterCredenciaisAntt(contaId);
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
