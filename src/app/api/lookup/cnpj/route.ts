import { NextRequest, NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";

interface ReceitaWsResponse {
  status: string;
  message?: string;
  nome?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}

export async function GET(request: NextRequest) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const cnpj = new URL(request.url).searchParams.get("cnpj")?.replace(/\D/g, "");
  if (!cnpj || cnpj.length !== 14) {
    return NextResponse.json({ mensagem: "CNPJ inválido." }, { status: 400 });
  }

  try {
    const res = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`);
    const data = (await res.json()) as ReceitaWsResponse;

    if (data.status === "ERROR") {
      return NextResponse.json({ mensagem: data.message ?? "CNPJ não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      razaoSocial: data.nome ?? "",
      rua: data.logradouro ?? "",
      numero: data.numero ?? "",
      bairro: data.bairro ?? "",
      municipio: data.municipio ?? "",
      uf: data.uf ?? "",
      cep: data.cep ?? "",
    });
  } catch {
    return NextResponse.json(
      { mensagem: "Falha ao consultar a ReceitaWS." },
      { status: 502 }
    );
  }
}
