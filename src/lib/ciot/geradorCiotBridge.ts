import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Gera o IdOperacaoTransporte chamando o binário oficial da ANTT (ponte
 * .NET em dotnet-bridge/), que por sua vez consulta a própria ANTT
 * (.../pefServices/token + .../pefServices/gerar). Ver dotnet-bridge/README.md.
 */
export async function gerarIdOperacaoTransporte(
  cpfCnpj: string,
  ambiente: "homologacao" | "producao"
): Promise<string> {
  const plataforma = process.platform === "win32" ? "win-x64" : "linux-x64";
  const executavel = process.platform === "win32" ? "GeradorCiot.exe" : "GeradorCiot";
  const binario = path.join(process.cwd(), "dotnet-bridge", "bin", plataforma, ambiente, executavel);

  const digitos = cpfCnpj.replace(/\D/g, "");

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(binario, [digitos], { timeout: 15000 }));
  } catch (error) {
    const saida = error instanceof Error && "stdout" in error ? String((error as { stdout?: string }).stdout ?? "") : "";
    throw new Error(
      saida ? extrairErro(saida) : `Falha ao executar o gerador de CIOT: ${error instanceof Error ? error.message : error}`
    );
  }

  return extrairCiot(stdout);
}

function extrairCiot(saida: string): string {
  const resultado = JSON.parse(saida.trim());
  if (!resultado.ok || !resultado.ciot) {
    throw new Error(resultado.erro ?? "Falha ao gerar IdOperacaoTransporte na ANTT.");
  }
  return resultado.ciot;
}

function extrairErro(saida: string): string {
  try {
    const resultado = JSON.parse(saida.trim());
    return resultado.erro ?? "Falha ao gerar IdOperacaoTransporte na ANTT.";
  } catch {
    return "Falha ao gerar IdOperacaoTransporte na ANTT.";
  }
}
