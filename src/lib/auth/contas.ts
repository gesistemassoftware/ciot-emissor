import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { migrar, query } from "@/lib/db";
import { checarChaveEmProducao, decrypt, encrypt } from "@/lib/crypto";
import type { TipoTransportador } from "@/lib/ciot/types";

export interface Conta {
  id: string;
  email: string;
  razaoSocial: string;
  cnpj: string;
  rntrc: string;
  tipoTransportador: TipoTransportador;
  anttAmbiente: "homologacao" | "producao";
  certificadoConfigurado: boolean;
  certificadoNomeArquivo: string | null;
}

interface ContaRow {
  id: string;
  email: string;
  senha_hash: string;
  razao_social: string;
  cnpj: string;
  rntrc: string;
  tipo_transportador: TipoTransportador;
  antt_ambiente: "homologacao" | "producao";
  certificado_criptografado: Buffer | null;
  certificado_iv: Buffer | null;
  certificado_nome_arquivo: string | null;
  passphrase_criptografada: Buffer | null;
  passphrase_iv: Buffer | null;
}

function paraConta(row: ContaRow): Conta {
  return {
    id: row.id,
    email: row.email,
    razaoSocial: row.razao_social,
    cnpj: row.cnpj,
    rntrc: row.rntrc,
    tipoTransportador: row.tipo_transportador,
    anttAmbiente: row.antt_ambiente,
    certificadoConfigurado: !!row.certificado_criptografado,
    certificadoNomeArquivo: row.certificado_nome_arquivo,
  };
}

export async function criarConta(dados: {
  email: string;
  senha: string;
  razaoSocial: string;
  cnpj: string;
  rntrc: string;
  tipoTransportador: TipoTransportador;
}): Promise<Conta> {
  await migrar();

  const existente = await query<ContaRow>("SELECT id FROM contas WHERE email = $1", [
    dados.email,
  ]);
  if (existente.length > 0) {
    throw new Error("Já existe uma conta com este e-mail.");
  }

  const id = randomUUID();
  const senhaHash = await bcrypt.hash(dados.senha, 10);

  const linhas = await query<ContaRow>(
    `INSERT INTO contas (id, email, senha_hash, razao_social, cnpj, rntrc, tipo_transportador)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, dados.email, senhaHash, dados.razaoSocial, dados.cnpj, dados.rntrc, dados.tipoTransportador]
  );

  return paraConta(linhas[0]);
}

export async function autenticar(email: string, senha: string): Promise<Conta | null> {
  await migrar();

  const linhas = await query<ContaRow>("SELECT * FROM contas WHERE email = $1", [email]);
  const row = linhas[0];
  if (!row) return null;

  const senhaValida = await bcrypt.compare(senha, row.senha_hash);
  if (!senhaValida) return null;

  return paraConta(row);
}

export async function buscarConta(id: string): Promise<Conta | null> {
  await migrar();
  const linhas = await query<ContaRow>("SELECT * FROM contas WHERE id = $1", [id]);
  return linhas[0] ? paraConta(linhas[0]) : null;
}

export async function atualizarAmbiente(
  contaId: string,
  ambiente: "homologacao" | "producao"
): Promise<void> {
  await query("UPDATE contas SET antt_ambiente = $1 WHERE id = $2", [ambiente, contaId]);
}

export async function salvarCertificado(
  contaId: string,
  pfx: Buffer,
  nomeArquivo: string,
  passphrase: string
): Promise<void> {
  checarChaveEmProducao();
  const certificado = encrypt(pfx);
  const passphraseCriptografada = encrypt(Buffer.from(passphrase, "utf-8"));

  await query(
    `UPDATE contas SET
       certificado_criptografado = $1,
       certificado_iv = $2,
       certificado_nome_arquivo = $3,
       passphrase_criptografada = $4,
       passphrase_iv = $5
     WHERE id = $6`,
    [
      certificado.dados,
      certificado.iv,
      nomeArquivo,
      passphraseCriptografada.dados,
      passphraseCriptografada.iv,
      contaId,
    ]
  );
}

export interface CertificadoDecodificado {
  pfx: Buffer;
  passphrase: string;
}

export async function obterCertificado(contaId: string): Promise<CertificadoDecodificado | null> {
  const linhas = await query<ContaRow>(
    "SELECT certificado_criptografado, certificado_iv, passphrase_criptografada, passphrase_iv FROM contas WHERE id = $1",
    [contaId]
  );
  const row = linhas[0];
  if (!row?.certificado_criptografado || !row.certificado_iv) return null;
  if (!row.passphrase_criptografada || !row.passphrase_iv) return null;

  return {
    pfx: decrypt(row.certificado_criptografado, row.certificado_iv),
    passphrase: decrypt(row.passphrase_criptografada, row.passphrase_iv).toString("utf-8"),
  };
}
