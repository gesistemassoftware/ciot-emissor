import { NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { encerrarCiotAntt } from "@/lib/ciot/anttClient";
import { obterCredenciaisAntt } from "@/lib/ciot/credenciais";
import { buscarCiot, encerrarCiotNoBanco } from "@/lib/ciot/store";

export async function POST(_request: Request, ctx: RouteContext<"/api/ciot/[id]/encerrar">) {
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
      { mensagem: `Só é possível encerrar um CIOT com status EMITIDO (atual: ${emissao.status}).` },
      { status: 400 }
    );
  }
  if (!emissao.numeroCiot || !emissao.codigoVerificador || emissao.protocoloOperadora?.startsWith("MOCK-")) {
    return NextResponse.json(
      { mensagem: "Esta emissão foi feita em modo simulado, não é possível encerrar na ANTT." },
      { status: 400 }
    );
  }

  const credenciais = await obterCredenciaisAntt(contaId);
  if (!credenciais) {
    return NextResponse.json(
      { mensagem: "Certificado ANTT não configurado — cadastre em Configurações." },
      { status: 400 }
    );
  }

  const resultado = await encerrarCiotAntt(emissao.numeroCiot, emissao.codigoVerificador, credenciais);

  if (!resultado.ok || !resultado.dataEncerramento) {
    return NextResponse.json(
      { mensagem: resultado.mensagemErro ?? "Falha ao encerrar o CIOT na ANTT." },
      { status: 502 }
    );
  }

  await encerrarCiotNoBanco(contaId, id, resultado.dataEncerramento);

  return NextResponse.json({
    ok: true,
    dataEncerramento: resultado.dataEncerramento,
    protocolo: resultado.protocolo,
  });
}
