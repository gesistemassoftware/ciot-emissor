import { NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { buscarCiot, excluirCiotDoBanco } from "@/lib/ciot/store";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/ciot/[id]">) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const emissao = await buscarCiot(contaId, id);
  if (!emissao) {
    return NextResponse.json({ mensagem: "CIOT não encontrado." }, { status: 404 });
  }

  const simulado = emissao.protocoloOperadora?.startsWith("MOCK-") ?? false;
  if (emissao.status === "EMITIDO" && !simulado) {
    return NextResponse.json(
      { mensagem: "Este CIOT está ativo na ANTT — cancele ou encerre antes de excluir do histórico." },
      { status: 400 }
    );
  }

  await excluirCiotDoBanco(contaId, id);
  return NextResponse.json({ ok: true });
}
