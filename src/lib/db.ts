import { Pool, type QueryResultRow } from "pg";

/**
 * Camada de acesso a banco única para toda a aplicação.
 *
 * Em produção (Vercel), aponte DATABASE_URL para um Postgres real (ex: Vercel
 * Postgres / Neon). Sem DATABASE_URL definido, usamos PGlite (Postgres
 * compilado para WASM, sem servidor) gravando em ./data/pglite — só para
 * desenvolvimento local, não serve para produção multi-instância.
 */

interface QueryClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
}

let clientPromise: Promise<QueryClient> | null = null;

async function criarClient(): Promise<QueryClient> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Bancos gerenciados (Render, Heroku etc.) usam certificado autoassinado;
      // sem isso o driver rejeita a conexão TLS em produção.
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
    return pool;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const pglite = new PGlite("./data/pglite");
  return {
    query: async (text, params) => {
      const result = await pglite.query(text, params as unknown[]);
      return { rows: result.rows as QueryResultRow[] };
    },
  } as QueryClient;
}

function getClient(): Promise<QueryClient> {
  if (!clientPromise) {
    clientPromise = criarClient();
  }
  return clientPromise;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await getClient();
  const result = await client.query<T>(text, params);
  return result.rows;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS contas (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  rntrc TEXT NOT NULL,
  tipo_transportador TEXT NOT NULL DEFAULT 'ETC',
  antt_ambiente TEXT NOT NULL DEFAULT 'homologacao',
  certificado_criptografado BYTEA,
  certificado_iv BYTEA,
  certificado_nome_arquivo TEXT,
  passphrase_criptografada BYTEA,
  passphrase_iv BYTEA,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emissoes (
  id UUID PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id),
  status TEXT NOT NULL,
  numero_ciot TEXT,
  codigo_verificador TEXT,
  protocolo_operadora TEXT,
  aviso_transportador TEXT,
  mensagem_erro TEXT,
  data_emissao TIMESTAMPTZ NOT NULL,
  input JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS emissoes_conta_id_idx ON emissoes (conta_id);

CREATE TABLE IF NOT EXISTS terceiros (
  id UUID PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id),
  papel TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL,
  nome_razao_social TEXT NOT NULL,
  email TEXT,
  rntrc TEXT,
  qtd_dependentes INT,
  rua TEXT NOT NULL,
  numero TEXT NOT NULL,
  bairro TEXT NOT NULL,
  cep TEXT NOT NULL,
  municipio TEXT NOT NULL,
  uf TEXT NOT NULL,
  celular_ddd TEXT,
  celular_numero TEXT,
  comercial_ddd TEXT,
  comercial_numero TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conta_id, papel, cpf_cnpj)
);

CREATE INDEX IF NOT EXISTS terceiros_conta_papel_idx ON terceiros (conta_id, papel);
`;

let migrado: Promise<void> | null = null;

export function migrar(): Promise<void> {
  if (!migrado) {
    migrado = (async () => {
      const client = await getClient();
      for (const statement of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
        await client.query(statement);
      }
    })();
  }
  return migrado;
}
