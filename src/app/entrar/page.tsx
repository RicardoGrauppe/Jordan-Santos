/*
  Entrada do painel. Portada da tela de login do estudio.html.

  Herdado de lá e mantido de propósito:
  - A mensagem de erro é sempre a mesma, sem dizer se o e-mail existe, e a
    recuperação responde igual tenha ou não conta naquele e-mail.
  - "Esqueci a senha" fica na LINHA DO RÓTULO da senha, não embaixo do botão:
    ali competiria com o "Entrar".
  - No celular a tela é ESTÁTICA (fixa, sem rolagem e sem gesto de pan): é um
    cartão só, e deixar rolar dava aquela borracha de página web no que devia
    parecer app. Os campos vão a 16px no celular porque abaixo disso o iOS dá
    zoom ao focar e não desfaz sozinho.
*/
"use client";

/* eslint-disable @next/next/no-img-element */
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
    <main className="fixed inset-0 flex touch-none items-center justify-center overflow-hidden bg-soft p-5 md:static md:min-h-dvh md:touch-auto md:overflow-auto">
      <div className="w-full max-w-[400px] rounded-[20px] bg-paper px-7 py-9 shadow-alta sm:px-9">
        <img
          src="/img/logo-principal-petroleo.png"
          alt="Jordan Santos"
          className="mx-auto block w-[154px]"
        />
        <h1 className="m-0 mb-7 mt-5 text-center text-[22px] font-medium tracking-[-.01em] text-ink">
          Bem-vindo de volta 👋
        </h1>

        <form onSubmit={enviar}>
          {/* autocorreção e maiúscula automática DESLIGADAS nos dois campos. No
              iPhone elas mexem no que a pessoa digitou: a primeira letra sobe,
              e a "pontuação inteligente" troca o hífen comum por travessão. No
              campo de senha isso vale principalmente quando o olho está aberto,
              porque aí ele vira `type=text` e o teclado passa a corrigir. */}
          <Campo
            id="email" rotulo="E-mail" type="email" autoComplete="email" required
            placeholder="voce@exemplo.com"
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            value={email} onChange={(e) => setEmail(e.target.value)}
          />

          <div className="relative">
            <Campo
              id="senha" rotulo="Senha" type={vendo ? "text" : "password"}
              autoComplete="current-password" required
              placeholder="Sua senha"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              className="pr-11"
              value={senha} onChange={(e) => setSenha(e.target.value)}
              acao={
                <button
                  type="button"
                  onClick={recuperar}
                  className={`cursor-pointer bg-transparent p-0 text-[12.5px] font-medium text-ink-soft hover:text-accent`}
                >
                  Esqueci a senha
                </button>
              }
            />
            <button
              type="button"
              onClick={() => setVendo((v) => !v)}
              aria-label={vendo ? "Ocultar senha" : "Mostrar senha"}
              className={`absolute right-2 top-[30px] inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-soft hover:bg-line`}
            >
              {vendo ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <Botao type="submit" className="mt-2 w-full" disabled={carregando}>
            {carregando ? <LoaderCircle size={16} className="animate-spin" /> : null}
            {carregando ? "Entrando…" : "Entrar"}
          </Botao>
        </form>

        <div className="mt-3 text-center">
          <Estado texto={msg.texto} tom={msg.tom} />
        </div>
      </div>
    </main>
  );
}
