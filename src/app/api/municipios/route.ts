import { NextRequest, NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { buscarMunicipios } from "@/lib/data/municipios";

export async function GET(request: NextRequest) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(buscarMunicipios(q));
}
