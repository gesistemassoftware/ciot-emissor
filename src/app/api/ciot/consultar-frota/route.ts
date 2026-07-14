import { NextRequest, NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { consultarFrotaTransportador } from "@/lib/ciot/anttClient";
import { obterCredenciaisAntt } from "@/lib/ciot/credenciais";

export async function POST(request: NextRequest) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const cpfCnpjTransportador = typeof body.cpfCnpjTransportador === "string" ? body.cpfCnpjTransportador : "";
  const rntrcTransportador = typeof body.rntrcTransportador === "string" ? body.rntrcTransportador : "";
  const placa = typeof body.placa === "string" ? body.placa : "";

  if (!cpfCnpjTransportador || !rntrcTransportador || !placa) {
    return NextResponse.json(
      { mensagem: "Informe CPF/CNPJ, RNTRC do contratado e a placa do veículo." },
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

  const resultado = await consultarFrotaTransportador(
    cpfCnpjTransportador,
    rntrcTransportador,
    [placa],
    credenciais
  );

  return NextResponse.json(resultado);
}
