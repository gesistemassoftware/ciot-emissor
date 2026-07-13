import dados from "./bancos.json";

export interface Banco {
  codigo: string;
  nome: string;
}

const BANCOS = dados as Banco[];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Lista oficial de instituições financeiras (código COMPE) obtida via
 * BrasilAPI, que espelha os dados públicos do Banco Central — snapshot
 * gerado em julho de 2026. Revalidar periodicamente.
 */
export function buscarBancos(termo: string, limite = 20): Banco[] {
  const alvo = normalizar(termo.trim());
  if (alvo.length < 2) return [];

  return BANCOS.filter(
    (b) => b.codigo.startsWith(termo.trim()) || normalizar(b.nome).includes(alvo)
  ).slice(0, limite);
}

export function buscarBancoPorCodigo(codigo: string): Banco | undefined {
  return BANCOS.find((b) => b.codigo === codigo);
}
