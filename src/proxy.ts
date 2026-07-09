import { NextRequest, NextResponse } from "next/server";
import { verificarSessao } from "@/lib/auth/jwt";

const ROTAS_PUBLICAS = ["/login", "/cadastro"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("sessao")?.value;
  const sessao = token ? await verificarSessao(token) : null;
  const rotaPublica = ROTAS_PUBLICAS.includes(pathname);

  if (!sessao && !rotaPublica) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  if (sessao && rotaPublica) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
