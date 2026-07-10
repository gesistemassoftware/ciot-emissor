import { NextRequest, NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { buscarNaturezaCarga } from "@/lib/data/naturezaCarga";

export async function GET(request: NextRequest) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(buscarNaturezaCarga(q));
}
