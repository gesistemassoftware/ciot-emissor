import dados from "./naturezaCarga.json";

export interface NaturezaCarga {
  codigo: string;
  descricao: string;
}

const NATUREZAS = dados as NaturezaCarga[];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Códigos conforme instruções de cadastramento da ANTT (Sistema Harmonizado
 * de Designação e Codificação de Mercadorias, nível de "posição" — 4
 * dígitos), extraído da tabela oficial NCM do Siscomex/CAMEX, mais os 3
 * códigos especiais definidos pela ANTT (0001, 0002, 0003).
 */
export function buscarNaturezaCarga(termo: string, limite = 20): NaturezaCarga[] {
  const alvo = normalizar(termo.trim());
  if (alvo.length < 2) return [];

  return NATUREZAS.filter(
    (n) => n.codigo.startsWith(termo.trim()) || normalizar(n.descricao).includes(alvo)
  ).slice(0, limite);
}

export function buscarNaturezaCargaPorCodigo(codigo: string): NaturezaCarga | undefined {
  return NATUREZAS.find((n) => n.codigo === codigo);
}
