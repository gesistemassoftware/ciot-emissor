import { NextRequest, NextResponse } from "next/server";
import { obterContaIdDaSessao } from "@/lib/auth/session";
import { buscarTerceiro, listarTerceiros } from "@/lib/ciot/terceiros";
import type { PapelTerceiro } from "@/lib/ciot/types";

const PAPEIS: PapelTerceiro[] = ["destinatario", "tomador", "contratado"];

function papelValido(papel: string | null): papel is PapelTerceiro {
  return !!papel && (PAPEIS as string[]).includes(papel);
}

export async function GET(request: NextRequest) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const papel = searchParams.get("papel");
  const cpfCnpj = searchParams.get("cpfCnpj");

  if (!papelValido(papel)) {
    return NextResponse.json({ mensagem: "Papel inválido." }, { status: 400 });
  }

  if (cpfCnpj) {
    const terceiro = await buscarTerceiro(contaId, papel, cpfCnpj);
    return NextResponse.json(terceiro);
  }

  const terceiros = await listarTerceiros(contaId, papel);
  return NextResponse.json(terceiros);
}
