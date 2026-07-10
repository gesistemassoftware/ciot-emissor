/**
 * Calcula a distância rodoviária aproximada entre dois municípios brasileiros
 * a partir do código IBGE, encadeando três serviços públicos gratuitos:
 *
 * 1. IBGE (localidades) — código IBGE → nome do município + UF.
 * 2. Nominatim (OpenStreetMap) — nome do município → latitude/longitude.
 * 3. OSRM (demo público) — duas coordenadas → distância de rota rodoviária.
 *
 * É uma estimativa para preencher "distância percorrida" mais rápido — os
 * servidores públicos do Nominatim/OSRM têm limite de uso e não são
 * garantidos para produção em escala; para volume alto, troque por um
 * provedor pago (Google, HERE, Mapbox) ou OSRM autohospedado.
 */

interface MunicipioIbge {
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
}

async function obterNomeMunicipio(codigoIbge: string): Promise<{ nome: string; uf: string }> {
  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${codigoIbge}`
  );
  if (!res.ok) throw new Error(`Município com código IBGE ${codigoIbge} não encontrado.`);
  const data = (await res.json()) as MunicipioIbge;
  const uf = data.microrregiao?.mesorregiao?.UF?.sigla;
  if (!uf) throw new Error(`Não foi possível determinar a UF do município ${codigoIbge}.`);
  return { nome: data.nome, uf };
}

async function geocodificar(nomeMunicipio: string, uf: string): Promise<{ lat: number; lon: number }> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("city", nomeMunicipio);
  url.searchParams.set("state", uf);
  url.searchParams.set("country", "Brazil");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url, {
    headers: { "User-Agent": "ciot-emissor/1.0 (contato via plataforma)" },
  });
  if (!res.ok) throw new Error("Falha ao geocodificar município (Nominatim).");
  const data = (await res.json()) as { lat: string; lon: string }[];
  if (data.length === 0) throw new Error(`Não foi possível localizar "${nomeMunicipio}/${uf}".`);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function calcularRota(
  origem: { lat: number; lon: number },
  destino: { lat: number; lon: number }
): Promise<number> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origem.lon},${origem.lat};${destino.lon},${destino.lat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao calcular rota (OSRM).");
  const data = (await res.json()) as { routes?: { distance: number }[] };
  if (!data.routes || data.routes.length === 0) throw new Error("Nenhuma rota encontrada entre os municípios.");
  return data.routes[0].distance / 1000;
}

export async function calcularDistanciaEntreMunicipios(
  codigoIbgeOrigem: string,
  codigoIbgeDestino: string
): Promise<{ distanciaKm: number; origem: string; destino: string }> {
  const [origem, destino] = await Promise.all([
    obterNomeMunicipio(codigoIbgeOrigem),
    obterNomeMunicipio(codigoIbgeDestino),
  ]);

  const [coordOrigem, coordDestino] = await Promise.all([
    geocodificar(origem.nome, origem.uf),
    geocodificar(destino.nome, destino.uf),
  ]);

  const distanciaKm = await calcularRota(coordOrigem, coordDestino);

  return {
    distanciaKm: Math.round(distanciaKm),
    origem: `${origem.nome}/${origem.uf}`,
    destino: `${destino.nome}/${destino.uf}`,
  };
}
