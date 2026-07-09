"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Conta {
  id: string;
  email: string;
  razaoSocial: string;
  cnpj: string;
  rntrc: string;
  tipoTransportador: "TAC" | "ETC" | "CTC";
  anttAmbiente: "homologacao" | "producao";
  certificadoConfigurado: boolean;
  certificadoNomeArquivo: string | null;
}

function Item({ ok, titulo, detalhe }: { ok: boolean; titulo: string; detalhe: string }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span
        className={
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
          (ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")
        }
      >
        {ok ? "✓" : "!"}
      </span>
      <div>
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-sm text-neutral-500">{detalhe}</p>
      </div>
    </li>
  );
}

export default function Configuracoes() {
  const router = useRouter();
  const [conta, setConta] = useState<Conta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [enviandoCert, setEnviandoCert] = useState(false);
  const [mensagemCert, setMensagemCert] = useState<string | null>(null);
  const [erroCert, setErroCert] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const res = await fetch("/api/config");
    if (res.ok) {
      setConta(await res.json());
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleAmbiente(ambiente: "homologacao" | "producao") {
    await fetch("/api/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anttAmbiente: ambiente }),
    });
    await carregar();
  }

  async function handleUploadCertificado(e: FormEvent) {
    e.preventDefault();
    setErroCert(null);
    setMensagemCert(null);

    if (!arquivo || !passphrase) {
      setErroCert("Selecione o arquivo .pfx e informe a senha.");
      return;
    }

    setEnviandoCert(true);
    try {
      const formData = new FormData();
      formData.append("certificado", arquivo);
      formData.append("passphrase", passphrase);

      const res = await fetch("/api/config/certificado", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setErroCert(data.mensagem ?? "Não foi possível salvar o certificado.");
        return;
      }

      setMensagemCert("Certificado salvo com sucesso.");
      setArquivo(null);
      setPassphrase("");
      await carregar();
    } catch {
      setErroCert("Falha de comunicação com o servidor.");
    } finally {
      setEnviandoCert(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl w-full px-6 py-10 flex-1">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Perfil da transportadora e certificado usado na emissão de CIOT
          </p>
        </div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Voltar para emissão
        </Link>
      </header>

      {carregando && <p className="text-sm text-neutral-500">Carregando...</p>}

      {conta && (
        <div className="space-y-8">
          <section className="rounded-xl border border-neutral-200 p-5">
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">Perfil da conta</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-neutral-500">E-mail</dt>
                <dd>{conta.email}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Razão social</dt>
                <dd>{conta.razaoSocial}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">CNPJ</dt>
                <dd>{conta.cnpj}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">RNTRC</dt>
                <dd>{conta.rntrc}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Tipo</dt>
                <dd>{conta.tipoTransportador}</dd>
              </div>
            </dl>
            {conta.tipoTransportador !== "ETC" && (
              <p className="text-xs text-amber-700 mt-3">
                O webservice direto da ANTT só atende ETC com frota própria — com o tipo atual
                a emissão real ficará bloqueada (modo simulado).
              </p>
            )}
          </section>

          <section className="rounded-xl border border-neutral-200 p-5">
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">Ambiente ANTT</h2>
            <div className="flex gap-3">
              <button
                onClick={() => handleAmbiente("homologacao")}
                className={
                  "rounded-lg px-4 py-2 text-sm font-medium border " +
                  (conta.anttAmbiente === "homologacao"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-neutral-300 text-neutral-700")
                }
              >
                Homologação
              </button>
              <button
                onClick={() => handleAmbiente("producao")}
                className={
                  "rounded-lg px-4 py-2 text-sm font-medium border " +
                  (conta.anttAmbiente === "producao"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-neutral-300 text-neutral-700")
                }
              >
                Produção
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-3">
              Teste sempre em homologação antes de emitir em produção.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 p-5">
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">
              Certificado ICP-Brasil (A1/A3)
            </h2>
            <ul className="divide-y divide-neutral-100 mb-4">
              <Item
                ok={conta.certificadoConfigurado}
                titulo={
                  conta.certificadoConfigurado
                    ? "Certificado configurado"
                    : "Nenhum certificado cadastrado"
                }
                detalhe={
                  conta.certificadoConfigurado
                    ? `Arquivo: ${conta.certificadoNomeArquivo}`
                    : "Sem certificado, a emissão roda em modo simulado."
                }
              />
            </ul>

            <form onSubmit={handleUploadCertificado} className="space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-600">Arquivo do certificado (.pfx)</span>
                <input
                  type="file"
                  accept=".pfx,.p12"
                  className="text-sm"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-600">Senha do certificado</span>
                <input
                  type="password"
                  className="input"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </label>

              {erroCert && (
                <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
                  {erroCert}
                </div>
              )}
              {mensagemCert && (
                <div className="rounded-lg border border-green-300 bg-green-50 text-green-800 px-4 py-3 text-sm">
                  {mensagemCert}
                </div>
              )}

              <button
                type="submit"
                disabled={enviandoCert}
                className="rounded-lg bg-blue-600 text-white px-6 py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {enviandoCert ? "Enviando..." : "Salvar certificado"}
              </button>
            </form>
            <p className="text-xs text-neutral-500 mt-4">
              O arquivo e a senha ficam criptografados no banco (AES-256-GCM) e só são
              decifrados no momento da chamada à ANTT.
            </p>
          </section>

          <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">
            Sair da conta
          </button>
        </div>
      )}
    </div>
  );
}
