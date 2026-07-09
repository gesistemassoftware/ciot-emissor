import { NextResponse } from "next/server";
import { limparCookieSessao } from "@/lib/auth/session";

export async function POST() {
  await limparCookieSessao();
  return NextResponse.json({ ok: true });
}
