import dados from "./municipios.json";

export interface Municipio {
  codigo: string;
  nome: string;
  uf: string;
}

const MUNICIPIOS = dados as Municipio[];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function buscarMunicipios(termo: string, limite = 20): Municipio[] {
  const alvo = normalizar(termo.trim());
  if (alvo.length < 2) return [];

  return MUNICIPIOS.filter((m) => normalizar(m.nome).includes(alvo)).slice(0, limite);
}

export function buscarMunicipioPorCodigo(codigo: string): Municipio | undefined {
  return MUNICIPIOS.find((m) => m.codigo === codigo);
}
