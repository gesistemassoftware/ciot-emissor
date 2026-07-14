import { createSecureContext } from "node:tls";
import { NextRequest, NextResponse } from "next/server";
import { salvarCertificado } from "@/lib/auth/contas";
import { obterContaIdDaSessao } from "@/lib/auth/session";

/**
 * Node só consegue relatar erro de PFX inválido de forma genérica
 * ("Unsupported PKCS12 PFX data" cobre tanto senha errada quanto um
 * algoritmo de criptografia do PKCS12 que o OpenSSL embutido não lê).
 * Validamos aqui, no upload, para não descobrir isso só na hora de emitir.
 */
function validarPfx(pfx: Buffer, passphrase: string): string | null {
  try {
    createSecureContext({ pfx, passphrase });
    return null;
  } catch {
    return "Não foi possível abrir o certificado. Verifique se a senha está correta e se o arquivo é o .pfx/.p12 do certificado (com a chave privada) — não o .cer/.crt. Se a senha estiver certa, o arquivo pode ter sido exportado com um algoritmo de criptografia que este servidor não suporta; tente reexportar o certificado no formato PKCS12 legado.";
  }
}

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

  const erroPfx = validarPfx(buffer, passphrase);
  if (erroPfx) {
    return NextResponse.json({ mensagem: erroPfx }, { status: 400 });
  }

  await salvarCertificado(contaId, buffer, nomeArquivo, passphrase);

  return NextResponse.json({ ok: true });
}
