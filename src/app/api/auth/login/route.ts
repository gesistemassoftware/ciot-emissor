import { NextRequest, NextResponse } from "next/server";
import { autenticar } from "@/lib/auth/contas";
import { definirCookieSessao } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string; senha?: string };

  if (!body.email || !body.senha) {
    return NextResponse.json({ mensagem: "Informe e-mail e senha." }, { status: 400 });
  }

  const conta = await autenticar(body.email, body.senha);
  if (!conta) {
    return NextResponse.json({ mensagem: "E-mail ou senha inválidos." }, { status: 401 });
  }

  await definirCookieSessao(conta.id);

  return NextResponse.json({ ok: true });
}
