import { SignJWT, jwtVerify } from "jose";

function obterSegredo() {
  const segredo = process.env.SESSION_SECRET ?? "dev-secret-nao-use-em-producao";
  return new TextEncoder().encode(segredo);
}

export async function criarSessao(contaId: string): Promise<string> {
  return new SignJWT({ contaId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(obterSegredo());
}

export async function verificarSessao(token: string): Promise<{ contaId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, obterSegredo());
    if (typeof payload.contaId !== "string") return null;
    return { contaId: payload.contaId };
  } catch {
    return null;
  }
}
