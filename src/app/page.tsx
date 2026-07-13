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
import type { PisoMinimoResultado } from "@/lib/pisoMinimo";

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
  implementos: [],
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
    contratantesCargaFrac: [],
  },
  pagamento: {
    tipoPagamento: 6,
    chavePix: "",
    cpfCnpjCreditado: "",
    codigoPagamento: "",
    identificadorPix: "",
    indPagamento: 0,
  },
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface MunicipioResultado {
  codigo: string;
  nome: string;
  uf: string;
}

interface NaturezaCargaResultado {
  codigo: string;
  descricao: string;
}

interface BancoResultado {
  codigo: string;
  nome: string;
}

interface ContaResumo {
  anttAmbiente: "homologacao" | "producao";
  certificadoConfigurado: boolean;
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
  const [calculandoDistancia, setCalculandoDistancia] = useState(false);
  const [erroDistancia, setErroDistancia] = useState<string | null>(null);
  const [calculandoPiso, setCalculandoPiso] = useState(false);
  const [pisoMinimo, setPisoMinimo] = useState<PisoMinimoResultado | null>(null);
  const [erroPiso, setErroPiso] = useState<string | null>(null);
  const [abaOperacao, setAbaOperacao] = useState<"carga" | "viagens">("carga");
  const [conta, setConta] = useState<ContaResumo | null>(null);
  const [alterandoAmbiente, setAlterandoAmbiente] = useState(false);
  const [novoContratanteFrac, setNovoContratanteFrac] = useState("");

  function adicionarContratanteFrac() {
    const valor = novoContratanteFrac.trim();
    if (!valor) return;
    setForm((f) => ({
      ...f,
      operacao: {
        ...f.operacao,
        contratantesCargaFrac: [...(f.operacao.contratantesCargaFrac ?? []), valor],
      },
    }));
    setNovoContratanteFrac("");
  }

  function removerContratanteFrac(index: number) {
    setForm((f) => ({
      ...f,
      operacao: {
        ...f.operacao,
        contratantesCargaFrac: (f.operacao.contratantesCargaFrac ?? []).filter((_, i) => i !== index),
      },
    }));
  }

  async function carregarConta() {
    const res = await fetch("/api/config");
    if (res.ok) setConta(await res.json());
  }

  async function handleAlternarAmbiente() {
    if (!conta) return;
    const novoAmbiente = conta.anttAmbiente === "homologacao" ? "producao" : "homologacao";
    setAlterandoAmbiente(true);
    try {
      await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anttAmbiente: novoAmbiente }),
      });
      await carregarConta();
    } finally {
      setAlterandoAmbiente(false);
    }
  }

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
    carregarConta();
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function handleEditar(item: CiotEmissaoResult) {
    setForm(item.input);
    setErro(null);
    setUltimoResultado(null);
    setAbaOperacao("carga");
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }

  async function handleBuscarTerceiro(papel: PapelTerceiro, cpfCnpj: string) {
    const encontrado = await buscarTerceiro(papel, cpfCnpj);
    if (!encontrado) return;
    setForm((f) => ({ ...f, [papel]: encontrado }));
  }

  async function handleCalcularDistancia() {
    const { codigoMunicipioOrigem, codigoMunicipioDestino } = form.operacao;
    if (!codigoMunicipioOrigem || !codigoMunicipioDestino) {
      setErroDistancia("Informe origem e destino primeiro.");
      return;
    }
    setCalculandoDistancia(true);
    setErroDistancia(null);
    try {
      const res = await fetch(
        `/api/distancia?origem=${codigoMunicipioOrigem}&destino=${codigoMunicipioDestino}`
      );
      const data = await res.json();
      if (!res.ok) {
        setErroDistancia(data.mensagem ?? "Não foi possível calcular a distância.");
        return;
      }
      setForm((f) => ({
        ...f,
        operacao: { ...f.operacao, distanciaPercorridaKm: data.distanciaKm },
      }));
    } catch {
      setErroDistancia("Falha de comunicação ao calcular distância.");
    } finally {
      setCalculandoDistancia(false);
    }
  }

  async function handleCalcularPiso() {
    setCalculandoPiso(true);
    setErroPiso(null);
    setPisoMinimo(null);
    try {
      const res = await fetch("/api/piso-minimo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigoTipoCarga: form.operacao.codigoTipoCarga,
          numeroEixos: form.veiculo.numeroEixos,
          distanciaKm: form.operacao.distanciaPercorridaKm,
          composicaoVeicular: form.operacao.composicaoVeicular,
          altoDesempenho: form.operacao.indAltoDesempenho,
          retornoVazio: form.operacao.indRetornoVazio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroPiso(data.mensagem ?? "Não foi possível calcular o piso mínimo.");
        return;
      }
      setPisoMinimo(data);
    } catch {
      setErroPiso("Falha de comunicação ao calcular o piso mínimo.");
    } finally {
      setCalculandoPiso(false);
    }
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

     console.log(data)

      if (!res.ok) {
        setErro(data.mensagemErro ?? data.mensagem ?? "Não foi possível emitir o CIOT.");
        if (data.status === "ERRO") setUltimoResultado(data);
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
    <div className="min-h-full flex-1 bg-navy-50">
      <div className="mx-auto max-w-4xl w-full px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">Emissão de CIOT</h1>
            <p className="text-sm text-navy-600 mt-1">
              Integração direta com a ANTT (webservice PEF · CIOT Para Todos) — apenas
              para ETC com frota própria vinculada ao RNTRC
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-4 whitespace-nowrap">
            <Link href="/configuracoes" className="text-sm text-navy-700 hover:text-navy-900 hover:underline">
              Configurações
            </Link>
            <button onClick={handleLogout} className="text-sm text-navy-500 hover:text-navy-700 hover:underline cursor-pointer">
              Sair
            </button>
          </div>
        </header>

        {conta && (
          <div
            className={
              "mb-6 flex items-center justify-between gap-4 rounded-lg border px-4 py-2.5 text-sm " +
              (conta.anttAmbiente === "homologacao"
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-emerald-300 bg-emerald-50 text-emerald-800")
            }
          >
            <span>
              Ambiente atual: <strong>{conta.anttAmbiente === "homologacao" ? "Homologação (testes)" : "Produção"}</strong>
              {!conta.certificadoConfigurado && " · sem certificado cadastrado, emissão roda em modo simulado"}
            </span>
            <button
              type="button"
              onClick={handleAlternarAmbiente}
              disabled={alterandoAmbiente}
              className="shrink-0 rounded-md border border-current/30 px-3 py-1 text-xs font-medium hover:bg-white/50 disabled:opacity-50 cursor-pointer"
            >
              {alterandoAmbiente
                ? "Alterando..."
                : conta.anttAmbiente === "homologacao"
                ? "Mudar para produção"
                : "Mudar para homologação (testes)"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </div>

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

          {form.operacao.composicaoVeicular && (
            <fieldset className="card p-5">
              <legend className="px-2 text-sm font-semibold text-navy-800">
                Implementos (reboque/semirreboque)
              </legend>
              <p className="text-xs text-navy-500 mb-3">
                A ANTT aceita até 5 placas por operação (veículo + até 4 implementos).
              </p>
              <div className="space-y-3">
                {(form.implementos ?? []).map((implemento, i) => (
                  <div key={i} className="flex gap-2 items-end border border-navy-100 rounded-lg p-3">
                    <Campo label="Placa" required className="flex-1">
                      <input
                        className="input uppercase"
                        value={implemento.placa}
                        onChange={(e) => {
                          const novos = [...(form.implementos ?? [])];
                          novos[i] = { ...novos[i], placa: e.target.value };
                          setForm((f) => ({ ...f, implementos: novos }));
                        }}
                        placeholder="ABC1D23"
                      />
                    </Campo>
                    <Campo label="Eixos" required className="w-20">
                      <input
                        type="number"
                        min={1}
                        max={9}
                        className="input"
                        value={implemento.numeroEixos}
                        onChange={(e) => {
                          const novos = [...(form.implementos ?? [])];
                          novos[i] = { ...novos[i], numeroEixos: Number(e.target.value) };
                          setForm((f) => ({ ...f, implementos: novos }));
                        }}
                      />
                    </Campo>
                    <Campo label="RNTRC (se diferente)" className="flex-1">
                      <input
                        className="input"
                        value={implemento.rntrc ?? ""}
                        onChange={(e) => {
                          const novos = [...(form.implementos ?? [])];
                          novos[i] = { ...novos[i], rntrc: e.target.value };
                          setForm((f) => ({ ...f, implementos: novos }));
                        }}
                      />
                    </Campo>
                    <button
                      type="button"
                      onClick={() => {
                        const novos = (form.implementos ?? []).filter((_, idx) => idx !== i);
                        setForm((f) => ({ ...f, implementos: novos }));
                      }}
                      className="btn-icon border-red-200 text-red-600 hover:bg-red-50"
                      aria-label={`Remover implemento ${i + 1}`}
                      title="Remover implemento"
                    >
                      <IconeLixeira />
                    </button>
                  </div>
                ))}
                {(form.implementos ?? []).length === 0 && (
                  <p className="text-sm text-navy-400">Nenhum implemento adicionado ainda.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    implementos: [...(f.implementos ?? []), { placa: "", numeroEixos: 2, rntrc: "" }],
                  }))
                }
                disabled={(form.implementos ?? []).length >= 4}
                className="btn-ghost mt-3 disabled:opacity-50"
              >
                + Adicionar implemento
              </button>
            </fieldset>
          )}

          <fieldset className="card p-5">
            <legend className="px-2 text-sm font-semibold text-navy-800">
              Operação de transporte
            </legend>

            <div className="flex gap-2 mb-4 border-b border-navy-100">
              <button
                type="button"
                onClick={() => setAbaOperacao("carga")}
                className={
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer transition-colors " +
                  (abaOperacao === "carga"
                    ? "border-navy-700 text-navy-800"
                    : "border-transparent text-navy-400 hover:text-navy-600")
                }
              >
                Carga
              </button>
              <button
                type="button"
                onClick={() => setAbaOperacao("viagens")}
                className={
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer transition-colors " +
                  (abaOperacao === "viagens"
                    ? "border-navy-700 text-navy-800"
                    : "border-transparent text-navy-400 hover:text-navy-600")
                }
              >
                Viagens
              </button>
            </div>

            {abaOperacao === "carga" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Valor do frete (R$)" required>
                  <div className="flex gap-2">
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
                    <button
                      type="button"
                      onClick={handleCalcularPiso}
                      disabled={calculandoPiso}
                      className="btn-ghost whitespace-nowrap"
                      title="Consultar piso mínimo de frete na calculadora oficial da ANTT"
                    >
                      {calculandoPiso ? "Calculando..." : "Piso mínimo ANTT"}
                    </button>
                  </div>
                  {erroPiso && <p className="text-xs text-red-600 mt-1">{erroPiso}</p>}
                  {pisoMinimo && (
                    <div className="text-xs text-navy-700 mt-1 bg-navy-50 border border-navy-100 rounded-lg p-2">
                      Piso mínimo ANTT:{" "}
                      <strong>
                        {pisoMinimo.valorPiso.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </strong>
                      {pisoMinimo.tabela && <> · {pisoMinimo.tabela}</>}
                      <button
                        type="button"
                        className="ml-2 text-navy-700 font-medium hover:underline cursor-pointer"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            operacao: { ...f.operacao, valorFrete: pisoMinimo.valorPiso },
                          }))
                        }
                      >
                        usar este valor
                      </button>
                    </div>
                  )}
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
                <NaturezaCargaAutocomplete
                  codigoAtual={form.operacao.codigoNaturezaCarga}
                  onSelect={(n) =>
                    setForm((f) => ({
                      ...f,
                      operacao: { ...f.operacao, codigoNaturezaCarga: n.codigo },
                    }))
                  }
                />
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

                {form.operacao.tipoOperacao === 2 && (
                  <div className="sm:col-span-2">
                    <span className="text-sm text-navy-600">
                      Outros contratantes da carga fracionada <span className="text-red-500">*</span>
                    </span>
                    <p className="text-xs text-navy-400 mb-2">
                      Obrigatório para Carga Fracionada — CPF/CNPJ de cada contratante adicional
                      da mesma viagem.
                    </p>
                    {(form.operacao.contratantesCargaFrac?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {form.operacao.contratantesCargaFrac!.map((cpfCnpj, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 bg-navy-100 text-navy-800 text-xs rounded-full pl-3 pr-2 py-1"
                          >
                            {cpfCnpj}
                            <button
                              type="button"
                              onClick={() => removerContratanteFrac(i)}
                              className="hover:text-red-600 cursor-pointer"
                              aria-label={`Remover ${cpfCnpj}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        className="input"
                        placeholder="CPF/CNPJ"
                        value={novoContratanteFrac}
                        onChange={(e) => setNovoContratanteFrac(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            adicionarContratanteFrac();
                          }
                        }}
                      />
                      <button type="button" onClick={adicionarContratanteFrac} className="btn-ghost whitespace-nowrap">
                        Adicionar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {abaOperacao === "viagens" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MunicipioAutocomplete
                  label="Origem"
                  nomeAtual={form.operacao.nomeMunicipioOrigem}
                  onSelect={(m) =>
                    setForm((f) => ({
                      ...f,
                      operacao: {
                        ...f.operacao,
                        codigoMunicipioOrigem: m.codigo,
                        nomeMunicipioOrigem: `${m.nome}/${m.uf}`,
                      },
                    }))
                  }
                />
                <MunicipioAutocomplete
                  label="Destino"
                  nomeAtual={form.operacao.nomeMunicipioDestino}
                  onSelect={(m) =>
                    setForm((f) => ({
                      ...f,
                      operacao: {
                        ...f.operacao,
                        codigoMunicipioDestino: m.codigo,
                        nomeMunicipioDestino: `${m.nome}/${m.uf}`,
                      },
                    }))
                  }
                />
                <Campo label="Distância percorrida (km)">
                  <div className="flex gap-2">
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
                    <button
                      type="button"
                      onClick={handleCalcularDistancia}
                      disabled={calculandoDistancia}
                      className="btn-ghost whitespace-nowrap"
                      title="Calcular distância entre origem e destino (roteirizador)"
                    >
                      {calculandoDistancia ? "Calculando..." : "Calcular"}
                    </button>
                  </div>
                  {erroDistancia && <p className="text-xs text-red-600 mt-1">{erroDistancia}</p>}
                </Campo>
              </div>
            )}
          </fieldset>

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
            <Campo label="Código do pagamento (referência, opcional)">
              <input
                className="input"
                value={form.pagamento.codigoPagamento ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pagamento: { ...f.pagamento, codigoPagamento: e.target.value },
                  }))
                }
                placeholder="Ex: código de boleto, id de depósito"
              />
            </Campo>

            {form.pagamento.tipoPagamento === 6 && (
              <>
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
                <Campo label="Identificador Pix" required>
                  <input
                    className="input"
                    value={form.pagamento.identificadorPix ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        pagamento: { ...f.pagamento, identificadorPix: e.target.value },
                      }))
                    }
                  />
                </Campo>
              </>
            )}

            {[2, 3, 4].includes(form.pagamento.tipoPagamento) && (
              <>
                <InstituicaoFinanceiraAutocomplete
                  codigoAtual={form.pagamento.codigoInstituicaoFinanceira}
                  onSelect={(b) =>
                    setForm((f) => ({
                      ...f,
                      pagamento: { ...f.pagamento, codigoInstituicaoFinanceira: b.codigo },
                    }))
                  }
                />
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
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm">
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
                <div className="text-xs text-emerald-700 mt-1">{ultimoResultado.mensagemErro}</div>
              )}
            </div>
          )}

          <button type="submit" disabled={enviando} className="btn-primary">
            {enviando ? "Emitindo..." : "Emitir CIOT"}
          </button>
        </form>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-navy-900 mb-3">Histórico de emissões</h2>
          {carregandoHistorico ? (
            <p className="text-sm text-navy-500">Carregando...</p>
          ) : historico.length === 0 ? (
            <p className="text-sm text-navy-500">Nenhum CIOT emitido ainda.</p>
          ) : (
            <div className="overflow-x-auto card">
              <table className="w-full text-sm">
                <thead className="bg-navy-900 text-left text-white">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Data</th>
                    <th className="px-4 py-2.5 font-medium">CIOT</th>
                    <th className="px-4 py-2.5 font-medium">Verificador</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Origem → Destino</th>
                    <th className="px-4 py-2.5 font-medium">Frete</th>
                    <th className="px-4 py-2.5 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((item) => (
                    <LinhaHistorico
                      key={item.id}
                      item={item}
                      onAtualizado={carregarHistorico}
                      onEditar={handleEditar}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function LinhaHistorico({
  item,
  onAtualizado,
  onEditar,
}: {
  item: CiotEmissaoResult;
  onAtualizado: () => void;
  onEditar: (item: CiotEmissaoResult) => void;
}) {
  const [mostrarCancelar, setMostrarCancelar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const simulado = item.protocoloOperadora?.startsWith("MOCK-") ?? false;
  const podeGerenciar = item.status === "EMITIDO" && !!item.numeroCiot && !simulado;
  const podeEditar = item.status === "ERRO" || item.status === "PENDENTE";

  async function handleExcluir() {
    if (!window.confirm("Excluir esta emissão do histórico? Esta ação não pode ser desfeita.")) {
      return;
    }
    setProcessando(true);
    setMensagem(null);
    try {
      const res = await fetch(`/api/ciot/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMensagem(data?.mensagem ?? "Falha ao excluir.");
        return;
      }
      onAtualizado();
    } catch {
      setMensagem("Falha de comunicação.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleCancelar() {
    if (!motivo.trim()) {
      setMensagem("Informe o motivo do cancelamento.");
      return;
    }
    setProcessando(true);
    setMensagem(null);
    try {
      const res = await fetch(`/api/ciot/${item.id}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMensagem(data.mensagem ?? "Falha ao cancelar.");
        return;
      }
      setMostrarCancelar(false);
      onAtualizado();
    } catch {
      setMensagem("Falha de comunicação.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleEncerrar() {
    setProcessando(true);
    setMensagem(null);
    try {
      const res = await fetch(`/api/ciot/${item.id}/encerrar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMensagem(data.mensagem ?? "Falha ao encerrar.");
        return;
      }
      onAtualizado();
    } catch {
      setMensagem("Falha de comunicação.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleConsultar() {
    setProcessando(true);
    setMensagem(null);
    try {
      const res = await fetch(`/api/ciot/${item.id}/consultar`);
      const data = await res.json();
      if (!res.ok) {
        setMensagem(data.mensagem ?? "Falha ao consultar.");
        return;
      }
      setMensagem(
        data.existe ? "CIOT confirmado na ANTT." : data.mensagem ?? "CIOT não encontrado na ANTT."
      );
    } catch {
      setMensagem("Falha de comunicação.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <tr className="border-t border-navy-100 align-top">
      <td className="px-4 py-2.5 text-navy-800">{new Date(item.dataEmissao).toLocaleString("pt-BR")}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-navy-800">{item.numeroCiot ?? "—"}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-navy-800">{item.codigoVerificador ?? "—"}</td>
      <td className="px-4 py-2.5">
        <span
          className={
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
            (item.status === "EMITIDO"
              ? "bg-emerald-100 text-emerald-700"
              : item.status === "ERRO"
              ? "bg-red-100 text-red-700"
              : item.status === "CANCELADO"
              ? "bg-navy-100 text-navy-500"
              : "bg-amber-100 text-amber-700")
          }
        >
          {item.status}
        </span>
      </td>
      <td className="px-4 py-2.5 text-navy-800">
        {item.input.operacao.nomeMunicipioOrigem || item.input.operacao.codigoMunicipioOrigem}{" "}
        → {item.input.operacao.nomeMunicipioDestino || item.input.operacao.codigoMunicipioDestino}
      </td>
      <td className="px-4 py-2.5 text-navy-800">{formatarMoeda(item.input.operacao.valorFrete)}</td>
      <td className="px-4 py-2.5">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            {podeGerenciar && (
              <>
                <button
                  type="button"
                  onClick={() => setMostrarCancelar((v) => !v)}
                  disabled={processando}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEncerrar}
                  disabled={processando}
                  className="text-xs text-navy-700 hover:underline disabled:opacity-50 cursor-pointer"
                >
                  Encerrar
                </button>
                <button
                  type="button"
                  onClick={handleConsultar}
                  disabled={processando}
                  className="text-xs text-navy-500 hover:underline disabled:opacity-50 cursor-pointer"
                >
                  Consultar
                </button>
              </>
            )}
            {!podeGerenciar && simulado && <span className="text-xs text-navy-300">simulado</span>}
            {!podeGerenciar && !simulado && item.status !== "EMITIDO" && (
              <button
                type="button"
                onClick={handleConsultar}
                disabled={processando}
                className="text-xs text-navy-500 hover:underline disabled:opacity-50 cursor-pointer"
              >
                Consultar
              </button>
            )}
            {podeEditar && (
              <button
                type="button"
                onClick={() => onEditar(item)}
                className="text-xs font-medium text-navy-800 hover:underline cursor-pointer"
              >
                Editar
              </button>
            )}
            <button
              type="button"
              onClick={handleExcluir}
              disabled={processando}
              className="text-xs text-red-500 hover:underline disabled:opacity-50 cursor-pointer"
            >
              Excluir
            </button>
          </div>
          {mostrarCancelar && (
            <div className="flex gap-1">
              <input
                className="input text-xs py-1"
                placeholder="Motivo do cancelamento"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <button
                type="button"
                onClick={handleCancelar}
                disabled={processando}
                className="shrink-0 rounded-lg border border-red-300 px-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          )}
          {mensagem && <p className="text-xs text-navy-400">{mensagem}</p>}
        </div>
      </td>
    </tr>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="card p-5">
      <legend className="px-2 text-sm font-semibold text-navy-800">{titulo}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">{children}</div>
    </fieldset>
  );
}

function IconeLupa({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "w-4 h-4"}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IconeLixeira({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "w-4 h-4"}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
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
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  async function handleBuscarCnpj() {
    const digitos = valor.cpfCnpj.replace(/\D/g, "");
    if (digitos.length !== 14) {
      setErroBusca("Busca automática só funciona para CNPJ (14 dígitos).");
      return;
    }
    setBuscandoCnpj(true);
    setErroBusca(null);
    try {
      const res = await fetch(`/api/lookup/cnpj?cnpj=${digitos}`);
      const data = await res.json();
      if (!res.ok) {
        setErroBusca(data.mensagem ?? "CNPJ não encontrado.");
        return;
      }
      onChange({
        ...valor,
        nomeRazaoSocial: data.razaoSocial || valor.nomeRazaoSocial,
        endereco: {
          ...valor.endereco,
          rua: data.rua || valor.endereco.rua,
          numero: data.numero || valor.endereco.numero,
          bairro: data.bairro || valor.endereco.bairro,
          municipio: data.municipio || valor.endereco.municipio,
          uf: data.uf || valor.endereco.uf,
          cep: data.cep || valor.endereco.cep,
        },
      });
    } catch {
      setErroBusca("Falha ao consultar CNPJ.");
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function handleBuscarCep() {
    const digitos = valor.endereco.cep.replace(/\D/g, "");
    if (digitos.length !== 8) {
      setErroBusca("CEP deve ter 8 dígitos.");
      return;
    }
    setBuscandoCep(true);
    setErroBusca(null);
    try {
      const res = await fetch(`/api/lookup/cep?cep=${digitos}`);
      const data = await res.json();
      if (!res.ok) {
        setErroBusca(data.mensagem ?? "CEP não encontrado.");
        return;
      }
      onChange({
        ...valor,
        endereco: {
          ...valor.endereco,
          rua: data.rua || valor.endereco.rua,
          bairro: data.bairro || valor.endereco.bairro,
          municipio: data.municipio || valor.endereco.municipio,
          uf: data.uf || valor.endereco.uf,
        },
      });
    } catch {
      setErroBusca("Falha ao consultar CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

  return (
    <fieldset className="card p-5">
      <legend className="px-2 text-sm font-semibold text-navy-800">{titulo}</legend>
      {descricao && <p className="text-xs text-navy-500 mb-3">{descricao}</p>}
      {erroBusca && <p className="text-xs text-red-600 mb-3">{erroBusca}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label="CPF/CNPJ" required>
          <div className="flex gap-2">
            <input
              className="input"
              value={valor.cpfCnpj}
              onChange={(e) => onChange({ ...valor, cpfCnpj: e.target.value })}
              onBlur={(e) => onBuscar(e.target.value)}
              placeholder={`Digite e saia do campo para buscar cadastro de ${papel}`}
            />
            <button
              type="button"
              onClick={handleBuscarCnpj}
              disabled={buscandoCnpj}
              className="btn-icon"
              aria-label="Buscar dados do CNPJ na Receita Federal"
              title="Buscar dados do CNPJ na Receita Federal"
            >
              <IconeLupa />
            </button>
          </div>
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
                className="input w-20!"
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
          <div className="flex gap-2">
            <input
              className="input"
              value={valor.endereco.cep}
              onChange={(e) =>
                onChange({ ...valor, endereco: { ...valor.endereco, cep: e.target.value } })
              }
            />
            <button
              type="button"
              onClick={handleBuscarCep}
              disabled={buscandoCep}
              className="btn-icon"
              aria-label="Buscar endereço pelo CEP"
              title="Buscar endereço pelo CEP"
            >
              <IconeLupa />
            </button>
          </div>
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
            className="input w-20!"
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
              className="input w-16!"
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
              className="input w-16!"
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

function MunicipioAutocomplete({
  label,
  nomeAtual,
  onSelect,
}: {
  label: string;
  nomeAtual?: string;
  onSelect: (m: MunicipioResultado) => void;
}) {
  const [query, setQuery] = useState(nomeAtual ?? "");
  const [resultados, setResultados] = useState<MunicipioResultado[]>([]);
  const [mostrando, setMostrando] = useState(false);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/municipios?q=${encodeURIComponent(query)}`);
        setResultados(res.ok ? await res.json() : []);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Campo label={label} required>
      <div className="relative">
        <div className="relative">
          <input
            className="input pl-8"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMostrando(true);
            }}
            onFocus={() => setMostrando(true)}
            onBlur={() => setTimeout(() => setMostrando(false), 150)}
            placeholder="Digite o nome da cidade..."
          />
          <IconeLupa className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-300" />
        </div>
        {mostrando && (buscando || resultados.length > 0) && (
          <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-navy-100 bg-white shadow-lg text-sm">
            {buscando && <li className="px-3 py-2 text-navy-300">Buscando...</li>}
            {resultados.map((m) => (
              <li key={m.codigo}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(m);
                    setQuery(`${m.nome}/${m.uf}`);
                    setMostrando(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-navy-50 cursor-pointer"
                >
                  {m.nome}/{m.uf}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Campo>
  );
}

function NaturezaCargaAutocomplete({
  codigoAtual,
  onSelect,
}: {
  codigoAtual: string;
  onSelect: (n: NaturezaCargaResultado) => void;
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<NaturezaCargaResultado[]>([]);
  const [mostrando, setMostrando] = useState(false);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/natureza-carga?q=${encodeURIComponent(query)}`);
        setResultados(res.ok ? await res.json() : []);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Campo label="Natureza da carga" required className="sm:col-span-2">
      <div className="relative">
        <div className="relative">
          <input
            className="input pl-8"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMostrando(true);
            }}
            onFocus={() => setMostrando(true)}
            onBlur={() => setTimeout(() => setMostrando(false), 150)}
            placeholder="Busque por código ou descrição (ex: soja, 1201)"
          />
          <IconeLupa className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-300" />
        </div>
        {codigoAtual && !mostrando && (
          <p className="text-xs text-navy-500 mt-1">Código selecionado: {codigoAtual}</p>
        )}
        {mostrando && (buscando || resultados.length > 0) && (
          <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-navy-100 bg-white shadow-lg text-sm">
            {buscando && <li className="px-3 py-2 text-navy-300">Buscando...</li>}
            {resultados.map((n) => (
              <li key={n.codigo}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(n);
                    setQuery(`${n.codigo} - ${n.descricao}`);
                    setMostrando(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-navy-50 cursor-pointer"
                >
                  <span className="font-mono text-xs text-navy-400">{n.codigo}</span>{" "}
                  {n.descricao}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Campo>
  );
}

function InstituicaoFinanceiraAutocomplete({
  codigoAtual,
  onSelect,
}: {
  codigoAtual?: string;
  onSelect: (b: BancoResultado) => void;
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<BancoResultado[]>([]);
  const [mostrando, setMostrando] = useState(false);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bancos?q=${encodeURIComponent(query)}`);
        setResultados(res.ok ? await res.json() : []);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Campo label="Instituição financeira" required>
      <div className="relative">
        <div className="relative">
          <input
            className="input pl-8"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMostrando(true);
            }}
            onFocus={() => setMostrando(true)}
            onBlur={() => setTimeout(() => setMostrando(false), 150)}
            placeholder="Busque por nome ou código (ex: Itaú, 341)"
          />
          <IconeLupa className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-300" />
        </div>
        {codigoAtual && !mostrando && (
          <p className="text-xs text-navy-500 mt-1">Código selecionado: {codigoAtual}</p>
        )}
        {mostrando && (buscando || resultados.length > 0) && (
          <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-navy-100 bg-white shadow-lg text-sm">
            {buscando && <li className="px-3 py-2 text-navy-300">Buscando...</li>}
            {resultados.map((b, i) => (
              <li key={`${b.codigo}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(b);
                    setQuery(`${b.codigo} - ${b.nome}`);
                    setMostrando(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-navy-50 cursor-pointer"
                >
                  <span className="font-mono text-xs text-navy-400">{b.codigo}</span> {b.nome}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Campo>
  );
}

function Campo({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={"flex flex-col gap-1 text-sm" + (className ? ` ${className}` : "")}>
      <span className="text-navy-600">
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
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-navy-700 cursor-pointer"
      />
      <span className="text-navy-700">{label}</span>
    </label>
  );
}
