"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.mensagem ?? "Não foi possível entrar.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-full flex-1 bg-navy-50 flex items-center justify-center px-6 py-16">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-navy-900 mb-1">Entrar</h1>
        <p className="text-sm text-navy-500 mb-8">Emissão de CIOT</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-600">E-mail</span>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-600">Senha</span>
            <input
              type="password"
              required
              className="input"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>

          {erro && (
            <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {erro}
            </div>
          )}

          <button type="submit" disabled={enviando} className="btn-primary w-full">
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-sm text-navy-500 mt-6">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="text-navy-700 font-medium hover:underline">
            Cadastre sua empresa
          </Link>
        </p>
      </div>
    </div>
  );
}
