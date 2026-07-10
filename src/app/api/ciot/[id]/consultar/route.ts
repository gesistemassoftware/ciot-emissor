import { NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { consultarCiotGeradoAntt } from "@/lib/ciot/anttClient";
import { obterCredenciaisAntt } from "@/lib/ciot/credenciais";
import { buscarCiot } from "@/lib/ciot/store";

export async function GET(_request: Request, ctx: RouteContext<"/api/ciot/[id]/consultar">) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const emissao = await buscarCiot(contaId, id);
  if (!emissao) {
    return NextResponse.json({ mensagem: "CIOT não encontrado." }, { status: 404 });
  }
  if (!emissao.numeroCiot || emissao.protocoloOperadora?.startsWith("MOCK-")) {
    return NextResponse.json(
      { mensagem: "Esta emissão foi feita em modo simulado, não há CIOT real para consultar." },
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

  const anoDeclaracao = new Date(emissao.dataEmissao).getFullYear();
  const resultado = await consultarCiotGeradoAntt(emissao.numeroCiot, anoDeclaracao, credenciais);

  return NextResponse.json({
    existe: resultado.existe,
    mensagem: resultado.mensagem,
    statusLocal: emissao.status,
  });
}
