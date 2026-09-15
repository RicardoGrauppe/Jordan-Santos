/*
  Entrada do painel. Portado da tela de login do estudio.html.

  Duas coisas herdadas de lá e mantidas de propósito: a mensagem de erro é
  sempre a mesma, sem dizer se o e-mail existe, e a recuperação responde igual
  tenha ou não conta naquele e-mail.
*/
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Botao, Campo, Estado } from "@/components/ui";

export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [vendo, setVendo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState<{ texto: string; tom?: "ok" | "erro" }>({ texto: "" });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setMsg({ texto: "" });
    try {
      const r = await fetch("/api/sessao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "entrar", email, senha }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "não consegui entrar");
      /* refresh antes do push: o layout do painel decide no servidor se há
         sessão, e sem isso ele decidiria com o cookie anterior */
      router.refresh();
      router.push("/painel");
    } catch (err) {
      setMsg({ texto: (err as Error).message, tom: "erro" });
      setCarregando(false);
    }
  }

  async function recuperar() {
    if (!email.trim()) { setMsg({ texto: "Escreva seu e-mail primeiro.", tom: "erro" }); return; }
    await fetch("/api/sessao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "recuperar", email }),
    });
    setMsg({ texto: "Se existir conta nesse e-mail, o link de redefinição chegou nele.", tom: "ok" });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-soft p-5">
      <div className="w-full max-w-[380px] rounded-[18px] bg-paper p-8 shadow-card">
        <h1 className="m-0 mb-1 text-[22px] font-semibold text-ink">Estúdio</h1>
        <p className="m-0 mb-6 text-sm text-ink-soft">Entre pra ver seus clientes e contratos.</p>

        <form onSubmit={enviar}>
          <Campo
            id="email" rotulo="E-mail" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />

          <div className="relative">
            <Campo
              id="senha" rotulo="Senha" type={vendo ? "text" : "password"}
              autoComplete="current-password" required className="pr-11"
              value={senha} onChange={(e) => setSenha(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setVendo((v) => !v)}
              aria-label={vendo ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-2 top-[30px] inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-soft [@media(hover:hover)]:hover:bg-soft"
            >
              {vendo ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <Botao type="submit" className="mt-2 w-full" disabled={carregando}>
            {carregando ? <LoaderCircle size={16} className="animate-spin" /> : null}
            {carregando ? "Entrando…" : "Entrar"}
          </Botao>
        </form>

        <div className="mt-3">
          <Estado texto={msg.texto} tom={msg.tom} />
        </div>

        <button
          type="button"
          onClick={recuperar}
          className="mt-2 cursor-pointer bg-transparent p-0 text-[13px] text-ink-soft underline-offset-2 [@media(hover:hover)]:hover:text-accent [@media(hover:hover)]:hover:underline"
        >
          Esqueci minha senha
        </button>
      </div>
    </main>
  );
}
