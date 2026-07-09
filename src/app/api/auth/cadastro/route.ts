import { NextRequest, NextResponse } from "next/server";
import { criarConta } from "@/lib/auth/contas";
import { definirCookieSessao } from "@/lib/auth/session";
import type { TipoTransportador } from "@/lib/ciot/types";

interface CadastroBody {
  email: string;
  senha: string;
  razaoSocial: string;
  cnpj: string;
  rntrc: string;
  tipoTransportador: TipoTransportador;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<CadastroBody>;

  if (!body.email || !body.senha || body.senha.length < 8) {
    return NextResponse.json(
      { mensagem: "E-mail e senha (mínimo 8 caracteres) são obrigatórios." },
      { status: 400 }
    );
  }
  if (!body.razaoSocial || !body.cnpj || !body.rntrc) {
    return NextResponse.json(
      { mensagem: "Razão social, CNPJ e RNTRC são obrigatórios." },
      { status: 400 }
    );
  }

  try {
    const conta = await criarConta({
      email: body.email,
      senha: body.senha,
      razaoSocial: body.razaoSocial,
      cnpj: body.cnpj,
      rntrc: body.rntrc,
      tipoTransportador: body.tipoTransportador ?? "ETC",
    });

    await definirCookieSessao(conta.id);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { mensagem: error instanceof Error ? error.message : "Não foi possível criar a conta." },
      { status: 400 }
    );
  }
}
