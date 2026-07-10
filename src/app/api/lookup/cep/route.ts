import { NextRequest, NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
}

export async function GET(request: NextRequest) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const cep = new URL(request.url).searchParams.get("cep")?.replace(/\D/g, "");
  if (!cep || cep.length !== 8) {
    return NextResponse.json({ mensagem: "CEP inválido." }, { status: 400 });
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = (await res.json()) as ViaCepResponse;

    if (data.erro) {
      return NextResponse.json({ mensagem: "CEP não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      rua: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      municipio: data.localidade ?? "",
      uf: data.uf ?? "",
      codigoIbge: data.ibge ?? "",
    });
  } catch {
    return NextResponse.json({ mensagem: "Falha ao consultar o ViaCEP." }, { status: 502 });
  }
}
