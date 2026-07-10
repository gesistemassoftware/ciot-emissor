import { buscarConta, obterCertificado } from "@/lib/auth/contas";
import type { AnttCredenciais } from "./anttClient";

const ANTT_BASE_URL_HML = "https://appservices-hml.antt.gov.br/pefServices";
const ANTT_BASE_URL_PROD = "https://appservices.antt.gov.br/pefServices";

/** null quando a conta ainda não tem certificado cadastrado (modo simulado). */
export async function obterCredenciaisAntt(contaId: string): Promise<AnttCredenciais | null> {
  const conta = await buscarConta(contaId);
  if (!conta?.certificadoConfigurado) return null;

  const certificado = await obterCertificado(contaId);
  if (!certificado) return null;

  return {
    baseUrl: conta.anttAmbiente === "producao" ? ANTT_BASE_URL_PROD : ANTT_BASE_URL_HML,
    pfx: certificado.pfx,
    passphrase: certificado.passphrase,
  };
}
