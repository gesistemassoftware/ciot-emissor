import { NextRequest, NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { calcularPisoMinimo } from "@/lib/pisoMinimo";

export async function POST(request: NextRequest) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();

  if (!body.codigoTipoCarga || !body.numeroEixos || !body.distanciaKm) {
    return NextResponse.json(
      { mensagem: "Informe tipo de carga, número de eixos e distância." },
      { status: 400 }
    );
  }

  try {
    const resultado = await calcularPisoMinimo({
      codigoTipoCarga: body.codigoTipoCarga,
      numeroEixos: body.numeroEixos,
      distanciaKm: body.distanciaKm,
      composicaoVeicular: !!body.composicaoVeicular,
      altoDesempenho: !!body.altoDesempenho,
      retornoVazio: !!body.retornoVazio,
    });
    return NextResponse.json(resultado);
  } catch (error) {
    return NextResponse.json(
      { mensagem: error instanceof Error ? error.message : "Falha ao consultar a calculadora ANTT." },
      { status: 502 }
    );
  }
}
