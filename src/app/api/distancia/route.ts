import { NextRequest, NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { calcularDistanciaEntreMunicipios } from "@/lib/distancia";

export async function GET(request: NextRequest) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const origem = searchParams.get("origem");
  const destino = searchParams.get("destino");

  if (!origem || !destino) {
    return NextResponse.json(
      { mensagem: "Informe o código IBGE de origem e destino." },
      { status: 400 }
    );
  }

  try {
    const resultado = await calcularDistanciaEntreMunicipios(origem, destino);
    return NextResponse.json(resultado);
  } catch (error) {
    return NextResponse.json(
      { mensagem: error instanceof Error ? error.message : "Falha ao calcular distância." },
      { status: 502 }
    );
  }
}
