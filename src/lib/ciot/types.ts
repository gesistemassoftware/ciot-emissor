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

/** Perfil da própria conta (a transportadora/ETC), usado como identidade do certificado. */
export interface Transportador {
  tipo: TipoTransportador;
  cpfCnpj: string;
  rntrc: string;
}

export interface Veiculo {
  placa: string;
  numeroEixos: number;
  /** RNTRCVeiculo, quando o veículo pertence a RNTRC diferente do contratado */
  rntrc?: string;
}

export interface Endereco {
  rua: string;
  numero: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
}

export interface Telefone {
  ddd: string;
  numero: string;
}

export type PapelTerceiro = "destinatario" | "tomador" | "contratado";

/**
 * Motorista/proprietário do veículo (Contratado), destinatário da carga, ou
 * tomador do serviço — cadastro reutilizável por CPF/CNPJ, no mesmo padrão
 * de sistemas de operadoras de CIOT. Só o CPF/CNPJ (e RNTRC, no caso do
 * contratado) é enviado à ANTT; o resto fica só na plataforma para reuso.
 */
export interface Terceiro {
  cpfCnpj: string;
  nomeRazaoSocial: string;
  email?: string;
  /** RNTRC — só se aplica ao papel "contratado" */
  rntrc?: string;
  /** Quantidade de dependentes — só se aplica ao papel "contratado" */
  qtdDependentes?: number;
  endereco: Endereco;
  celular?: Telefone;
  comercial?: Telefone;
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

/**
 * Dados preenchidos a cada emissão. Contratado, destinatário e tomador são
 * cadastros reutilizáveis (buscados/salvos por CPF/CNPJ) — a transportadora
 * (conta) pode subcontratar motoristas/veículos diferentes a cada operação.
 */
export interface CiotEmissaoInput {
  contratante: Contratante;
  contratado: Terceiro;
  destinatario: Terceiro;
  tomador: Terceiro;
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
