/**
 * Integração com a calculadora pública de Piso Mínimo de Frete da ANTT
 * (https://calculadorafrete.antt.gov.br), conforme Resolução ANTT nº 5.867/2020.
 *
 * A ANTT não expõe essa calculadora como API JSON — é um formulário ASP.NET
 * MVC clássico que responde com HTML. Fazemos aqui o que um navegador faria:
 * 1. GET na página para capturar o token anti-forgery e o cookie de sessão;
 * 2. POST com os mesmos campos do formulário, reaproveitando cookie e token;
 * 3. Extrai o valor calculado do HTML de resposta.
 *
 * Por depender da estrutura HTML do site da ANTT (sem contrato de API
 * formal), pode quebrar se a ANTT alterar o site — nesse caso os coeficientes
 * (CCD/CC) precisariam ser obtidos de outra forma ou mantidos manualmente.
 */

const CALCULADORA_URL = "https://calculadorafrete.antt.gov.br/?Length=4";

export interface PisoMinimoResultado {
  valorPiso: number;
  tabela?: string;
  ccd?: string;
  cc?: string;
  valorIda?: string;
  valorRetornoVazio?: string;
}

function decodificarEntidadesHtml(texto: string): string {
  return texto
    .replace(/&#(\d+);/g, (_, codigo) => String.fromCharCode(Number(codigo)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

function extrairEntre(html: string, inicio: string, regexValor: RegExp): string | undefined {
  const idx = html.indexOf(inicio);
  if (idx === -1) return undefined;
  const trecho = html.slice(idx, idx + 400);
  const match = trecho.match(regexValor);
  return match?.[1]?.trim() ? decodificarEntidadesHtml(match[1].trim()) : undefined;
}

function paraNumero(valorBr: string): number {
  return parseFloat(valorBr.replace(/\./g, "").replace(",", "."));
}

export async function calcularPisoMinimo(params: {
  codigoTipoCarga: string;
  numeroEixos: number;
  distanciaKm: number;
  composicaoVeicular: boolean;
  altoDesempenho: boolean;
  retornoVazio: boolean;
}): Promise<PisoMinimoResultado> {
  const getRes = await fetch(CALCULADORA_URL);
  const getHtml = await getRes.text();
  const cookies = getRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  const tokenMatch = getHtml.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/);
  const token = tokenMatch?.[1];
  if (!token) {
    throw new Error("Não foi possível obter o token da calculadora ANTT (layout do site pode ter mudado).");
  }

  const body = new URLSearchParams();
  body.append("__RequestVerificationToken", token);
  body.append("Filtro.IdTipoCarga", params.codigoTipoCarga);
  body.append("Filtro.NumeroEixos", String(params.numeroEixos));
  body.append("Filtro.Distancia", String(params.distanciaKm));
  if (params.composicaoVeicular) body.append("Filtro.CargaLotacao", "true");
  body.append("Filtro.CargaLotacao", "false");
  if (params.altoDesempenho) body.append("Filtro.AltoDesempenho", "true");
  body.append("Filtro.AltoDesempenho", "false");
  if (params.retornoVazio) body.append("Filtro.RetornoVazio", "true");
  body.append("Filtro.RetornoVazio", "false");

  const postRes = await fetch(CALCULADORA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    body: body.toString(),
  });
  const postHtml = await postRes.text();

  const valorMatch = postHtml.match(/class="col-xs-12 valorFrete">\s*R\$\s*([\d.,]+)/);
  if (!valorMatch) {
    throw new Error("Não foi possível ler o valor calculado (layout do site da ANTT pode ter mudado).");
  }

  return {
    valorPiso: paraNumero(valorMatch[1]),
    tabela: extrairEntre(postHtml, "Operação de Transporte:", /font-weight: bold;">([^<]+)</),
    ccd: extrairEntre(postHtml, "(CCD)", /font-weight: bold;">\s*([^<]+)</),
    cc: extrairEntre(postHtml, "(CC)", /font-weight: bold;">([^<]+)</),
    valorIda: extrairEntre(postHtml, "Valor de ida", /font-weight: bold;">([^<]+)</),
    valorRetornoVazio: extrairEntre(postHtml, "Valor do retorno vazio", /font-weight: bold;">\s*([^<]+)</),
  };
}
