"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TipoTransportador } from "@/lib/ciot/types";

export default function Cadastro() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    senha: "",
    razaoSocial: "",
    cnpj: "",
    rntrc: "",
    tipoTransportador: "ETC" as TipoTransportador,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);

    try {
      const res = await fetch("/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.mensagem ?? "Não foi possível criar a conta.");
        return;
      }

      router.push("/configuracoes");
      router.refresh();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-full flex-1 bg-navy-50 flex items-center justify-center px-6 py-16">
      <div className="card w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-navy-900 mb-1">Cadastrar empresa</h1>
        <p className="text-sm text-navy-500 mb-8">
          Emissão de CIOT — cada conta representa uma transportadora. Para emitir
          de verdade, ela precisa ser ETC com frota própria e RNTRC ativo.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-600">E-mail</span>
            <input
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-600">Senha (mínimo 8 caracteres)</span>
            <input
              type="password"
              required
              minLength={8}
              className="input"
              value={form.senha}
              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-600">Razão social</span>
            <input
              required
              className="input"
              value={form.razaoSocial}
              onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-navy-600">CNPJ</span>
              <input
                required
                className="input"
                value={form.cnpj}
                onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-navy-600">RNTRC</span>
              <input
                required
                className="input"
                value={form.rntrc}
                onChange={(e) => setForm((f) => ({ ...f, rntrc: e.target.value }))}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-600">Tipo de transportador</span>
            <select
              className="input"
              value={form.tipoTransportador}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tipoTransportador: e.target.value as TipoTransportador,
                }))
              }
            >
              <option value="ETC">ETC – Empresa de Transporte (frota própria)</option>
              <option value="TAC">TAC – Autônomo</option>
              <option value="CTC">CTC – Cooperativa</option>
            </select>
            {form.tipoTransportador !== "ETC" && (
              <span className="text-xs text-amber-700">
                O webservice direto da ANTT só atende ETC com frota própria — TAC/CTC podem
                cadastrar a conta, mas a emissão real ficará bloqueada.
              </span>
            )}
          </label>

          {erro && (
            <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {erro}
            </div>
          )}

          <button type="submit" disabled={enviando} className="btn-primary w-full">
            {enviando ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="text-sm text-navy-500 mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-navy-700 font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
