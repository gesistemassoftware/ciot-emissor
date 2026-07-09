export type TipoTransportador = "TAC" | "ETC" | "CTC";

/** 1 - Carga Lotação; 2 - Carga Fracionada; 3 - TAC-Agregado (DCS PEF v1.1) */
export type TipoOperacao = 1 | 2 | 3;

/** 1-12 conforme tabela oficial de Tipo de Carga da ANTT (DCS PEF v1.1) */
export type CodigoTipoCarga = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12";

/** 1-IP; 2-Conta Corrente; 3-Conta Poupança; 4-Conta Pagamento; 5-Outros; 6-Pix */
export type TipoPagamento = 1 | 2 | 3 | 4 | 5 | 6;

export interface Contratante {
  /** CpfCnpjContratante */
  cnpj: string;
  /** uso interno, não enviado à ANTT */
  razaoSocial: string;
}

/**
 * Dados do transportador (Contratado perante a ANTT). Não fazem parte do
 * formulário de emissão — vêm do perfil da conta (uma conta = uma ETC),
 * já que o certificado usado na emissão é o do próprio CNPJ do transportador.
 */
export interface Transportador {
  tipo: TipoTransportador;
  /** CpfCnpjContratado */
  cpfCnpj: string;
  /** RNTRCContratado */
  rntrc: string;
}

export interface Veiculo {
  placa: string;
  numeroEixos: number;
  /** RNTRCVeiculo, quando o veículo pertence a RNTRC diferente do transportador */
  rntrc?: string;
}

export interface Operacao {
  tipoOperacao: TipoOperacao;
  /** Código IBGE do município de origem */
  codigoMunicipioOrigem: string;
  /** apenas para exibição local, não enviado à ANTT */
  nomeMunicipioOrigem?: string;
  /** Código IBGE do município de destino */
  codigoMunicipioDestino: string;
  nomeMunicipioDestino?: string;
  distanciaPercorridaKm: number;
  dataInicioViagem: string;
  dataFimViagem: string;
  /** Código conforme tabela oficial de Natureza de Carga da ANTT */
  codigoNaturezaCarga: string;
  pesoCargaKg: number;
  codigoTipoCarga: CodigoTipoCarga;
  valorFrete: number;
  cpfCnpjDestinatario?: string;
  /** obrigatórios pela ANTT quando tipoOperacao = 1 (Carga Lotação) */
  indAltoDesempenho: boolean;
  indRetornoVazio: boolean;
  composicaoVeicular: boolean;
  indContingencia: boolean;
  justificativaContingencia?: string;
}

export interface Pagamento {
  tipoPagamento: TipoPagamento;
  codigoInstituicaoFinanceira?: string;
  numeroAgencia?: string;
  numeroConta?: string;
  chavePix?: string;
  cpfCnpjCreditado?: string;
  /** 0 = à vista; 1 = a prazo */
  indPagamento: 0 | 1;
  numeroParcela?: number;
  dataVencimento?: string;
  valorParcela?: number;
}

/** Dados preenchidos a cada emissão. O transportador vem do perfil da conta. */
export interface CiotEmissaoInput {
  contratante: Contratante;
  veiculo: Veiculo;
  operacao: Operacao;
  pagamento: Pagamento;
}

export type CiotStatus = "EMITIDO" | "ERRO" | "PENDENTE";

export interface CiotEmissaoResult {
  id: string;
  status: CiotStatus;
  /** CodigoIdentificacaoOperacao retornado pela ANTT */
  numeroCiot?: string;
  codigoVerificador?: string;
  protocoloOperadora?: string;
  avisoTransportador?: string;
  mensagemErro?: string;
  dataEmissao: string;
  input: CiotEmissaoInput;
}
