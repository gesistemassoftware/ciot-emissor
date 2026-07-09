import { NextRequest, NextResponse } from "next/server";
import { salvarCertificado } from "@/lib/auth/contas";
import { obterContaIdDaSessao } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const contaId = await obterContaIdDaSessao();
  if (!contaId) {
    return NextResponse.json({ mensagem: "Não autenticado." }, { status: 401 });
  }

  const formData = await request.formData();
  const arquivo = formData.get("certificado");
  const passphrase = formData.get("passphrase");

  if (!(arquivo instanceof Blob) || arquivo.size === 0) {
    return NextResponse.json(
      { mensagem: "Selecione o arquivo do certificado (.pfx)." },
      { status: 400 }
    );
  }
  if (typeof passphrase !== "string" || !passphrase) {
    return NextResponse.json({ mensagem: "Informe a senha do certificado." }, { status: 400 });
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const nomeArquivo = arquivo instanceof File ? arquivo.name : "certificado.pfx";

  await salvarCertificado(contaId, buffer, nomeArquivo, passphrase);

  return NextResponse.json({ ok: true });
}
