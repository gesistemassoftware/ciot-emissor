"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CiotEmissaoInput,
  CiotEmissaoResult,
  CodigoTipoCarga,
  PapelTerceiro,
  Terceiro,
  TipoOperacao,
  TipoPagamento,
} from "@/lib/ciot/types";

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

const TIPOS_CARGA: { value: CodigoTipoCarga; label: string }[] = [
  { value: "1", label: "1 - Granel sólido" },
  { value: "2", label: "2 - Granel líquido" },
  { value: "3", label: "3 - Frigorificada ou Aquecida" },
  { value: "4", label: "4 - Conteinerizada" },
  { value: "5", label: "5 - Carga Geral" },
  { value: "6", label: "6 - Neogranel" },
  { value: "7", label: "7 - Perigosa (granel sólido)" },
  { value: "8", label: "8 - Perigosa (granel líquido)" },
  { value: "9", label: "9 - Perigosa (Frigorificada ou Aquecida)" },
  { value: "10", label: "10 - Perigosa (conteinerizada)" },
  { value: "11", label: "11 - Perigosa (carga geral)" },
  { value: "12", label: "12 - Carga Granel Pressurizada" },
];

const TIPOS_PAGAMENTO: { value: TipoPagamento; label: string }[] = [
  { value: 1, label: "1 - IP (cartão pré-pago)" },
  { value: 2, label: "2 - Conta Corrente" },
  { value: 3, label: "3 - Conta Poupança" },
  { value: 4, label: "4 - Conta Pagamento" },
  { value: 5, label: "5 - Outros" },
  { value: 6, label: "6 - Pix" },
];

const TERCEIRO_VAZIO: Terceiro = {
  cpfCnpj: "",
  nomeRazaoSocial: "",
  email: "",
  rntrc: "",
  qtdDependentes: undefined,
  endereco: { rua: "", numero: "", bairro: "", cep: "", municipio: "", uf: "SP" },
  celular: { ddd: "", numero: "" },
  comercial: { ddd: "", numero: "" },
};

const FORM_INICIAL: CiotEmissaoInput = {
  contratante: { cnpj: "", razaoSocial: "" },
  contratado: { ...TERCEIRO_VAZIO },
  destinatario: { ...TERCEIRO_VAZIO },
  tomador: { ...TERCEIRO_VAZIO },
  veiculo: { placa: "", numeroEixos: 2, rntrc: "" },
  operacao: {
    tipoOperacao: 1,
    codigoMunicipioOrigem: "",
    nomeMunicipioOrigem: "",
    codigoMunicipioDestino: "",
    nomeMunicipioDestino: "",
    distanciaPercorridaKm: 0,
    dataInicioViagem: new Date().toISOString().slice(0, 10),
    dataFimViagem: new Date().toISOString().slice(0, 10),
    codigoNaturezaCarga: "",
    pesoCargaKg: 0,
    codigoTipoCarga: "5",
    valorFrete: 0,
    indAltoDesempenho: false,
    indRetornoVazio: false,
    composicaoVeicular: false,
    indContingencia: false,
    justificativaContingencia: "",
  },
  pagamento: {
    tipoPagamento: 6,
    chavePix: "",
    cpfCnpjCreditado: "",
    indPagamento: 0,
  },
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function buscarTerceiro(papel: PapelTerceiro, cpfCnpj: string): Promise<Terceiro | null> {
  if (!cpfCnpj) return null;
  const res = await fetch(`/api/terceiros?papel=${papel}&cpfCnpj=${encodeURIComponent(cpfCnpj)}`);
  if (!res.ok) return null;
  return res.json();
}

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState<CiotEmissaoInput>(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimoResultado, setUltimoResultado] = useState<CiotEmissaoResult | null>(null);
  const [historico, setHistorico] = useState<CiotEmissaoResult[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  async function carregarHistorico() {
    setCarregandoHistorico(true);
    try {
      const res = await fetch("/api/ciot");
      const data = await res.json();
      setHistorico(data);
    } finally {
      setCarregandoHistorico(false);
    }
  }

  useEffect(() => {
    carregarHistorico();
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleBuscarTerceiro(papel: PapelTerceiro, cpfCnpj: string) {
    const encontrado = await buscarTerceiro(papel, cpfCnpj);
    if (!encontrado) return;
    setForm((f) => ({ ...f, [papel]: encontrado }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    setUltimoResultado(null);

    try {
      const res = await fetch("/api/ciot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.mensagem ?? "Não foi possível emitir o CIOT.");
        return;
      }

      setUltimoResultado(data);
      if (data.status === "ERRO") {
        setErro(data.mensagemErro ?? "A ANTT retornou um erro.");
      }
      await carregarHistorico();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl w-full px-6 py-10 flex-1">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Emissão de CIOT</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Integração direta com a ANTT (webservice PEF · CIOT Para Todos) — apenas
            para ETC com frota própria vinculada ao RNTRC
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-4 whitespace-nowrap">
          <Link href="/configuracoes" className="text-sm text-blue-600 hover:underline">
            ⚙ Configurações
          </Link>
          <button onClick={handleLogout} className="text-sm text-neutral-500 hover:underline">
            Sair
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Secao titulo="Contratante">
          <Campo label="CNPJ/CPF do contratante" required>
            <input
              className="input"
              value={form.contratante.cnpj}
              onChange={(e) =>
                setForm((f) => ({ ...f, contratante: { ...f.contratante, cnpj: e.target.value } }))
              }
              placeholder="00.000.000/0000-00"
            />
          </Campo>
          <Campo label="Razão social (referência local)">
            <input
              className="input"
              value={form.contratante.razaoSocial}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  contratante: { ...f.contratante, razaoSocial: e.target.value },
                }))
              }
            />
          </Campo>
        </Secao>

        <TerceiroSecao
          titulo="Contratado / Proprietário do Veículo"
          descricao="Motorista ou dono do veículo que vai efetivamente rodar esta operação — pode variar a cada emissão (ex: TAC subcontratado)."
          papel="contratado"
          valor={form.contratado}
          onChange={(v) => setForm((f) => ({ ...f, contratado: v }))}
          onBuscar={(cpfCnpj) => handleBuscarTerceiro("contratado", cpfCnpj)}
          mostrarRntrc
        />

        <TerceiroSecao
          titulo="Destinatário"
          descricao="Quem recebe a carga."
          papel="destinatario"
          valor={form.destinatario}
          onChange={(v) => setForm((f) => ({ ...f, destinatario: v }))}
          onBuscar={(cpfCnpj) => handleBuscarTerceiro("destinatario", cpfCnpj)}
        />

        <TerceiroSecao
          titulo="Tomador do Serviço"
          descricao="Quem solicitou/paga pelo serviço de transporte (pode ser o próprio contratante)."
          papel="tomador"
          valor={form.tomador}
          onChange={(v) => setForm((f) => ({ ...f, tomador: v }))}
          onBuscar={(cpfCnpj) => handleBuscarTerceiro("tomador", cpfCnpj)}
        />

        <Secao titulo="Veículo">
          <Campo label="Placa" required>
            <input
              className="input uppercase"
              value={form.veiculo.placa}
              onChange={(e) =>
                setForm((f) => ({ ...f, veiculo: { ...f.veiculo, placa: e.target.value } }))
              }
              placeholder="ABC1D23"
            />
          </Campo>
          <Campo label="Número de eixos" required>
            <input
              type="number"
              min={1}
              max={9}
              className="input"
              value={form.veiculo.numeroEixos}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  veiculo: { ...f.veiculo, numeroEixos: Number(e.target.value) },
                }))
              }
            />
          </Campo>
          <Campo label="RNTRC do veículo (se diferente do contratado)">
            <input
              className="input"
              value={form.veiculo.rntrc}
              onChange={(e) =>
                setForm((f) => ({ ...f, veiculo: { ...f.veiculo, rntrc: e.target.value } }))
              }
            />
          </Campo>
        </Secao>

        <Secao titulo="Operação de transporte">
          <Campo label="Tipo de operação">
            <select
              className="input"
              value={form.operacao.tipoOperacao}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: {
                    ...f.operacao,
                    tipoOperacao: Number(e.target.value) as TipoOperacao,
                  },
                }))
              }
            >
              <option value={1}>1 - Carga Lotação</option>
              <option value={2}>2 - Carga Fracionada</option>
              <option value={3}>3 - TAC-Agregado</option>
            </select>
          </Campo>
          <Campo label="Código IBGE do município de origem" required>
            <input
              className="input"
              value={form.operacao.codigoMunicipioOrigem}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: { ...f.operacao, codigoMunicipioOrigem: e.target.value },
                }))
              }
              placeholder="Ex: 5002704"
            />
          </Campo>
          <Campo label="Município de origem (referência local)">
            <input
              className="input"
              value={form.operacao.nomeMunicipioOrigem}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: { ...f.operacao, nomeMunicipioOrigem: e.target.value },
                }))
              }
            />
          </Campo>
          <Campo label="Código IBGE do município de destino" required>
            <input
              className="input"
              value={form.operacao.codigoMunicipioDestino}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: { ...f.operacao, codigoMunicipioDestino: e.target.value },
                }))
              }
              placeholder="Ex: 3550308"
            />
          </Campo>
          <Campo label="Município de destino (referência local)">
            <input
              className="input"
              value={form.operacao.nomeMunicipioDestino}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: { ...f.operacao, nomeMunicipioDestino: e.target.value },
                }))
              }
            />
          </Campo>
          <Campo label="Distância percorrida (km)">
            <input
              type="number"
              min={0}
              className="input"
              value={form.operacao.distanciaPercorridaKm}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: { ...f.operacao, distanciaPercorridaKm: Number(e.target.value) },
                }))
              }
            />
          </Campo>
          <Campo label="Data início da viagem" required>
            <input
              type="date"
              className="input"
              value={form.operacao.dataInicioViagem}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: { ...f.operacao, dataInicioViagem: e.target.value },
                }))
              }
            />
          </Campo>
          <Campo label="Data fim da viagem" required>
            <input
              type="date"
              className="input"
              value={form.operacao.dataFimViagem}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: { ...f.operacao, dataFimViagem: e.target.value },
                }))
              }
            />
          </Campo>
          <Campo label="Código da natureza da carga" required>
            <input
              className="input"
              value={form.operacao.codigoNaturezaCarga}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: { ...f.operacao, codigoNaturezaCarga: e.target.value },
                }))
              }
              placeholder="Conforme tabela oficial ANTT"
            />
          </Campo>
          <Campo label="Peso da carga (kg)">
            <input
              type="number"
              min={0}
              className="input"
              value={form.operacao.pesoCargaKg}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: { ...f.operacao, pesoCargaKg: Number(e.target.value) },
                }))
              }
            />
          </Campo>
          <Campo label="Código do tipo de carga" required>
            <select
              className="input"
              value={form.operacao.codigoTipoCarga}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: {
                    ...f.operacao,
                    codigoTipoCarga: e.target.value as CodigoTipoCarga,
                  },
                }))
              }
            >
              {TIPOS_CARGA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Valor do frete (R$)" required>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={form.operacao.valorFrete}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operacao: { ...f.operacao, valorFrete: Number(e.target.value) },
                }))
              }
            />
          </Campo>
        </Secao>

        <Secao titulo="Indicadores operacionais (obrigatórios para Carga Lotação)">
          <Checkbox
            label="Alto desempenho"
            checked={form.operacao.indAltoDesempenho}
            onChange={(v) =>
              setForm((f) => ({ ...f, operacao: { ...f.operacao, indAltoDesempenho: v } }))
            }
          />
          <Checkbox
            label="Retorno vazio"
            checked={form.operacao.indRetornoVazio}
            onChange={(v) =>
              setForm((f) => ({ ...f, operacao: { ...f.operacao, indRetornoVazio: v } }))
            }
          />
          <Checkbox
            label="Composição veicular"
            checked={form.operacao.composicaoVeicular}
            onChange={(v) =>
              setForm((f) => ({ ...f, operacao: { ...f.operacao, composicaoVeicular: v } }))
            }
          />
        </Secao>

        <Secao titulo="Contingência">
          <Checkbox
            label="Emitir em contingência"
            checked={form.operacao.indContingencia}
            onChange={(v) =>
              setForm((f) => ({ ...f, operacao: { ...f.operacao, indContingencia: v } }))
            }
          />
          {form.operacao.indContingencia && (
            <Campo label="Justificativa da contingência" required>
              <input
                className="input"
                value={form.operacao.justificativaContingencia}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    operacao: { ...f.operacao, justificativaContingencia: e.target.value },
                  }))
                }
              />
            </Campo>
          )}
        </Secao>

        <Secao titulo="Pagamento">
          <Campo label="Tipo de pagamento">
            <select
              className="input"
              value={form.pagamento.tipoPagamento}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  pagamento: {
                    ...f.pagamento,
                    tipoPagamento: Number(e.target.value) as TipoPagamento,
                  },
                }))
              }
            >
              {TIPOS_PAGAMENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="CPF/CNPJ do creditado">
            <input
              className="input"
              value={form.pagamento.cpfCnpjCreditado}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  pagamento: { ...f.pagamento, cpfCnpjCreditado: e.target.value },
                }))
              }
            />
          </Campo>

          {form.pagamento.tipoPagamento === 6 && (
            <Campo label="Chave Pix">
              <input
                className="input"
                value={form.pagamento.chavePix}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pagamento: { ...f.pagamento, chavePix: e.target.value },
                  }))
                }
              />
            </Campo>
          )}

          {[2, 3, 4].includes(form.pagamento.tipoPagamento) && (
            <>
              <Campo label="Código da instituição financeira">
                <input
                  className="input"
                  value={form.pagamento.codigoInstituicaoFinanceira}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      pagamento: { ...f.pagamento, codigoInstituicaoFinanceira: e.target.value },
                    }))
                  }
                />
              </Campo>
              <Campo label="Agência">
                <input
                  className="input"
                  value={form.pagamento.numeroAgencia}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      pagamento: { ...f.pagamento, numeroAgencia: e.target.value },
                    }))
                  }
                />
              </Campo>
              <Campo label="Conta">
                <input
                  className="input"
                  value={form.pagamento.numeroConta}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      pagamento: { ...f.pagamento, numeroConta: e.target.value },
                    }))
                  }
                />
              </Campo>
            </>
          )}

          <Campo label="Condição de pagamento">
            <select
              className="input"
              value={form.pagamento.indPagamento}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  pagamento: {
                    ...f.pagamento,
                    indPagamento: Number(e.target.value) as 0 | 1,
                  },
                }))
              }
            >
              <option value={0}>À vista</option>
              <option value={1}>A prazo</option>
            </select>
          </Campo>

          {form.pagamento.indPagamento === 1 && (
            <>
              <Campo label="Data de vencimento">
                <input
                  type="date"
                  className="input"
                  value={form.pagamento.dataVencimento}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      pagamento: { ...f.pagamento, dataVencimento: e.target.value },
                    }))
                  }
                />
              </Campo>
              <Campo label="Valor da parcela (R$)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  value={form.pagamento.valorParcela}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      pagamento: {
                        ...f.pagamento,
                        numeroParcela: 1,
                        valorParcela: Number(e.target.value),
                      },
                    }))
                  }
                />
              </Campo>
            </>
          )}
        </Secao>

        {erro && (
          <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {erro}
          </div>
        )}

        {ultimoResultado && ultimoResultado.status === "EMITIDO" && (
          <div className="rounded-lg border border-green-300 bg-green-50 text-green-800 px-4 py-3 text-sm">
            CIOT emitido com sucesso: <strong>{ultimoResultado.numeroCiot}</strong>
            {ultimoResultado.codigoVerificador && (
              <> · Código verificador: <strong>{ultimoResultado.codigoVerificador}</strong></>
            )}
            {ultimoResultado.avisoTransportador && (
              <div className="text-xs text-amber-700 mt-1">
                Aviso ANTT: {ultimoResultado.avisoTransportador}
              </div>
            )}
            {ultimoResultado.mensagemErro && (
              <div className="text-xs text-green-700 mt-1">{ultimoResultado.mensagemErro}</div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-blue-600 text-white px-6 py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {enviando ? "Emitindo..." : "Emitir CIOT"}
        </button>
      </form>

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-3">Histórico de emissões</h2>
        {carregandoHistorico ? (
          <p className="text-sm text-neutral-500">Carregando...</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum CIOT emitido ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-left">
                <tr>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">CIOT</th>
                  <th className="px-4 py-2">Verificador</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Origem → Destino</th>
                  <th className="px-4 py-2">Frete</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((item) => (
                  <tr key={item.id} className="border-t border-neutral-200">
                    <td className="px-4 py-2">
                      {new Date(item.dataEmissao).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{item.numeroCiot ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {item.codigoVerificador ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          item.status === "EMITIDO"
                            ? "text-green-700"
                            : item.status === "ERRO"
                            ? "text-red-700"
                            : "text-amber-700"
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {item.input.operacao.nomeMunicipioOrigem ||
                        item.input.operacao.codigoMunicipioOrigem}{" "}
                      →{" "}
                      {item.input.operacao.nomeMunicipioDestino ||
                        item.input.operacao.codigoMunicipioDestino}
                    </td>
                    <td className="px-4 py-2">{formatarMoeda(item.input.operacao.valorFrete)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="border border-neutral-200 rounded-xl p-5">
      <legend className="px-2 text-sm font-semibold text-neutral-700">{titulo}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">{children}</div>
    </fieldset>
  );
}

function TerceiroSecao({
  titulo,
  descricao,
  papel,
  valor,
  onChange,
  onBuscar,
  mostrarRntrc,
}: {
  titulo: string;
  descricao?: string;
  papel: PapelTerceiro;
  valor: Terceiro;
  onChange: (v: Terceiro) => void;
  onBuscar: (cpfCnpj: string) => void;
  mostrarRntrc?: boolean;
}) {
  return (
    <fieldset className="border border-neutral-200 rounded-xl p-5">
      <legend className="px-2 text-sm font-semibold text-neutral-700">{titulo}</legend>
      {descricao && <p className="text-xs text-neutral-500 mb-3">{descricao}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label="CPF/CNPJ" required>
          <input
            className="input"
            value={valor.cpfCnpj}
            onChange={(e) => onChange({ ...valor, cpfCnpj: e.target.value })}
            onBlur={(e) => onBuscar(e.target.value)}
            placeholder={`Digite e saia do campo para buscar cadastro de ${papel}`}
          />
        </Campo>
        <Campo label="Nome / Razão social" required>
          <input
            className="input"
            value={valor.nomeRazaoSocial}
            onChange={(e) => onChange({ ...valor, nomeRazaoSocial: e.target.value })}
          />
        </Campo>
        <Campo label="E-mail">
          <input
            type="email"
            className="input"
            value={valor.email ?? ""}
            onChange={(e) => onChange({ ...valor, email: e.target.value })}
          />
        </Campo>
        {mostrarRntrc && (
          <>
            <Campo label="RNTRC" required>
              <input
                className="input"
                value={valor.rntrc ?? ""}
                onChange={(e) => onChange({ ...valor, rntrc: e.target.value })}
              />
            </Campo>
            <Campo label="Qtd. dependentes">
              <input
                type="number"
                min={0}
                className="input"
                value={valor.qtdDependentes ?? ""}
                onChange={(e) =>
                  onChange({ ...valor, qtdDependentes: Number(e.target.value) })
                }
              />
            </Campo>
          </>
        )}

        <Campo label="Rua" required>
          <input
            className="input"
            value={valor.endereco.rua}
            onChange={(e) => onChange({ ...valor, endereco: { ...valor.endereco, rua: e.target.value } })}
          />
        </Campo>
        <Campo label="Número" required>
          <input
            className="input"
            value={valor.endereco.numero}
            onChange={(e) =>
              onChange({ ...valor, endereco: { ...valor.endereco, numero: e.target.value } })
            }
          />
        </Campo>
        <Campo label="Bairro" required>
          <input
            className="input"
            value={valor.endereco.bairro}
            onChange={(e) =>
              onChange({ ...valor, endereco: { ...valor.endereco, bairro: e.target.value } })
            }
          />
        </Campo>
        <Campo label="CEP" required>
          <input
            className="input"
            value={valor.endereco.cep}
            onChange={(e) =>
              onChange({ ...valor, endereco: { ...valor.endereco, cep: e.target.value } })
            }
          />
        </Campo>
        <Campo label="Município" required>
          <input
            className="input"
            value={valor.endereco.municipio}
            onChange={(e) =>
              onChange({ ...valor, endereco: { ...valor.endereco, municipio: e.target.value } })
            }
          />
        </Campo>
        <Campo label="UF">
          <select
            className="input"
            value={valor.endereco.uf}
            onChange={(e) =>
              onChange({ ...valor, endereco: { ...valor.endereco, uf: e.target.value } })
            }
          >
            {ESTADOS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Celular (DDD + número)">
          <div className="flex gap-2">
            <input
              className="input w-16"
              placeholder="DDD"
              value={valor.celular?.ddd ?? ""}
              onChange={(e) =>
                onChange({ ...valor, celular: { ddd: e.target.value, numero: valor.celular?.numero ?? "" } })
              }
            />
            <input
              className="input"
              value={valor.celular?.numero ?? ""}
              onChange={(e) =>
                onChange({ ...valor, celular: { ddd: valor.celular?.ddd ?? "", numero: e.target.value } })
              }
            />
          </div>
        </Campo>
        <Campo label="Comercial (DDD + número)">
          <div className="flex gap-2">
            <input
              className="input w-16"
              placeholder="DDD"
              value={valor.comercial?.ddd ?? ""}
              onChange={(e) =>
                onChange({ ...valor, comercial: { ddd: e.target.value, numero: valor.comercial?.numero ?? "" } })
              }
            />
            <input
              className="input"
              value={valor.comercial?.numero ?? ""}
              onChange={(e) =>
                onChange({ ...valor, comercial: { ddd: valor.comercial?.ddd ?? "", numero: e.target.value } })
              }
            />
          </div>
        </Campo>
      </div>
    </fieldset>
  );
}

function Campo({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-neutral-600">{label}</span>
    </label>
  );
}
