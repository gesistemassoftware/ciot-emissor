import { cookies } from "next/headers";
import { criarSessao, verificarSessao } from "./jwt";

const NOME_COOKIE = "sessao";

export async function definirCookieSessao(contaId: string) {
  const token = await criarSessao(contaId);
  const store = await cookies();
  store.set(NOME_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function limparCookieSessao() {
  const store = await cookies();
  store.delete(NOME_COOKIE);
}

export async function obterContaIdDaSessao(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(NOME_COOKIE)?.value;
  if (!token) return null;
  const sessao = await verificarSessao(token);
  return sessao?.contaId ?? null;
}
