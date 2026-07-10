import { randomUUID } from "crypto";
import { migrar, query } from "@/lib/db";
import type { PapelTerceiro, Terceiro } from "./types";

interface TerceiroRow {
  cpf_cnpj: string;
  nome_razao_social: string;
  email: string | null;
  rntrc: string | null;
  qtd_dependentes: number | null;
  rua: string;
  numero: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  celular_ddd: string | null;
  celular_numero: string | null;
  comercial_ddd: string | null;
  comercial_numero: string | null;
}

function paraTerceiro(row: TerceiroRow): Terceiro {
  return {
    cpfCnpj: row.cpf_cnpj,
    nomeRazaoSocial: row.nome_razao_social,
    email: row.email ?? undefined,
    rntrc: row.rntrc ?? undefined,
    qtdDependentes: row.qtd_dependentes ?? undefined,
    endereco: {
      rua: row.rua,
      numero: row.numero,
      bairro: row.bairro,
      cep: row.cep,
      municipio: row.municipio,
      uf: row.uf,
    },
    celular:
      row.celular_ddd || row.celular_numero
        ? { ddd: row.celular_ddd ?? "", numero: row.celular_numero ?? "" }
        : undefined,
    comercial:
      row.comercial_ddd || row.comercial_numero
        ? { ddd: row.comercial_ddd ?? "", numero: row.comercial_numero ?? "" }
        : undefined,
  };
}

export async function listarTerceiros(
  contaId: string,
  papel: PapelTerceiro
): Promise<Terceiro[]> {
  await migrar();
  const linhas = await query<TerceiroRow>(
    "SELECT * FROM terceiros WHERE conta_id = $1 AND papel = $2 ORDER BY nome_razao_social",
    [contaId, papel]
  );
  return linhas.map(paraTerceiro);
}

export async function buscarTerceiro(
  contaId: string,
  papel: PapelTerceiro,
  cpfCnpj: string
): Promise<Terceiro | null> {
  await migrar();
  const linhas = await query<TerceiroRow>(
    "SELECT * FROM terceiros WHERE conta_id = $1 AND papel = $2 AND cpf_cnpj = $3",
    [contaId, papel, cpfCnpj]
  );
  return linhas[0] ? paraTerceiro(linhas[0]) : null;
}

export async function salvarTerceiro(
  contaId: string,
  papel: PapelTerceiro,
  dados: Terceiro
): Promise<void> {
  await migrar();
  await query(
    `INSERT INTO terceiros
       (id, conta_id, papel, cpf_cnpj, nome_razao_social, email, rntrc, qtd_dependentes,
        rua, numero, bairro, cep, municipio, uf, celular_ddd, celular_numero,
        comercial_ddd, comercial_numero)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (conta_id, papel, cpf_cnpj) DO UPDATE SET
       nome_razao_social = EXCLUDED.nome_razao_social,
       email = EXCLUDED.email,
       rntrc = EXCLUDED.rntrc,
       qtd_dependentes = EXCLUDED.qtd_dependentes,
       rua = EXCLUDED.rua,
       numero = EXCLUDED.numero,
       bairro = EXCLUDED.bairro,
       cep = EXCLUDED.cep,
       municipio = EXCLUDED.municipio,
       uf = EXCLUDED.uf,
       celular_ddd = EXCLUDED.celular_ddd,
       celular_numero = EXCLUDED.celular_numero,
       comercial_ddd = EXCLUDED.comercial_ddd,
       comercial_numero = EXCLUDED.comercial_numero`,
    [
      randomUUID(),
      contaId,
      papel,
      dados.cpfCnpj,
      dados.nomeRazaoSocial,
      dados.email ?? null,
      dados.rntrc ?? null,
      dados.qtdDependentes ?? null,
      dados.endereco.rua,
      dados.endereco.numero,
      dados.endereco.bairro,
      dados.endereco.cep,
      dados.endereco.municipio,
      dados.endereco.uf,
      dados.celular?.ddd ?? null,
      dados.celular?.numero ?? null,
      dados.comercial?.ddd ?? null,
      dados.comercial?.numero ?? null,
    ]
  );
}
