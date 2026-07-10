import { NextRequest, NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { cancelarCiotAntt } from "@/lib/ciot/anttClient";
import { obterCredenciaisAntt } from "@/lib/ciot/credenciais";
import { buscarCiot, cancelarCiotNoBanco } from "@/lib/ciot/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/ciot/[id]/cancelar">) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const emissao = await buscarCiot(contaId, id);
  if (!emissao) {
    return NextResponse.json({ mensagem: "CIOT não encontrado." }, { status: 404 });
  }
  if (emissao.status !== "EMITIDO") {
    return NextResponse.json(
      { mensagem: `Só é possível cancelar um CIOT com status EMITIDO (atual: ${emissao.status}).` },
      { status: 400 }
    );
  }
  if (!emissao.numeroCiot || !emissao.codigoVerificador || emissao.protocoloOperadora?.startsWith("MOCK-")) {
    return NextResponse.json(
      { mensagem: "Esta emissão foi feita em modo simulado, não é possível cancelar na ANTT." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  if (!motivo) {
    return NextResponse.json({ mensagem: "Informe o motivo do cancelamento." }, { status: 400 });
  }

  const credenciais = await obterCredenciaisAntt(contaId);
  if (!credenciais) {
    return NextResponse.json(
      { mensagem: "Certificado ANTT não configurado — cadastre em Configurações." },
      { status: 400 }
    );
  }

  const resultado = await cancelarCiotAntt(
    emissao.numeroCiot,
    emissao.codigoVerificador,
    motivo,
    credenciais
  );

  if (!resultado.ok || !resultado.dataCancelamento) {
    return NextResponse.json(
      { mensagem: resultado.mensagemErro ?? "Falha ao cancelar o CIOT na ANTT." },
      { status: 502 }
    );
  }

  await cancelarCiotNoBanco(contaId, id, resultado.dataCancelamento, motivo);

  return NextResponse.json({
    ok: true,
    dataCancelamento: resultado.dataCancelamento,
    protocolo: resultado.protocolo,
  });
}
