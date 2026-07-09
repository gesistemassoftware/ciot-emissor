import { NextRequest, NextResponse } from "next/server";
import { atualizarAmbiente, buscarConta } from "@/lib/auth/contas";
import { obterContaIdDaSessao } from "@/lib/auth/session";

export async function GET() {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const conta = await buscarConta(contaId);
  if (!conta) {
    return NextResponse.json({ mensagem: "Conta não encontrada." }, { status: 404 });
  }

  return NextResponse.json(conta);
}

export async function PATCH(request: NextRequest) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as { anttAmbiente?: "homologacao" | "producao" };
  if (body.anttAmbiente) {
    await atualizarAmbiente(contaId, body.anttAmbiente);
  }

  return NextResponse.json({ ok: true });
}
