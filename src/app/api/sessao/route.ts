/*
  Login, logout, recuperação e troca de senha, em cima do Supabase Auth.
  Portado de `api/sessao.js` do estúdio do Jordan, preservando as decisões de
  segurança que estavam lá (elas são o motivo do arquivo, não detalhe).

  POST {acao:"entrar", email, senha}    → sessão de 7 dias, só pra admin
  POST {acao:"sair"}                    → expira o cookie
  POST {acao:"recuperar", email}        → dispara o e-mail de redefinição
  POST {acao:"trocar-senha", atual, nova}
  GET                                   → {ok, role, email} se o cookie valer
*/
import { NextResponse } from "next/server";
import { supabaseConfigurado, loginSenha, recuperarSenha, trocarSenha } from "@/lib/supabase";
import { assinar, gravarCookie, limparCookie, sessaoAtual } from "@/lib/sessao";
import { criarLimite, esperar, ipDe } from "@/lib/util";

const DIA = 86400;
const SESSAO_SEGUNDOS = 7 * DIA;

/* Throttle por IP. Em memória de propósito: zera no cold start e serve pra
   atrapalhar força bruta, não pra ser contabilidade. */
const estourou = criarLimite(15 * 60_000, 30);

export async function GET() {
  const sessao = await sessaoAtual();
  if (!sessao) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, role: sessao.role, email: sessao.email ?? null });
}

export async function POST(req: Request) {
  try {
    const corpo = await req.json().catch(() => ({}));
    const acao = corpo?.acao;

    if (acao === "sair") {
      await limparCookie();
      return NextResponse.json({ ok: true });
    }

    if (!supabaseConfigurado()) {
      return NextResponse.json({ erro: "banco não configurado" }, { status: 500 });
    }

    const ip = ipDe(req.headers);
    if (estourou(ip ?? "sem-ip")) {
      await esperar(800);
      return NextResponse.json({ erro: "muitas tentativas, aguarde alguns minutos" }, { status: 429 });
    }

    if (acao === "entrar") {
      const email = String(corpo.email ?? "").trim().toLowerCase();
      const senha = String(corpo.senha ?? "");

      /* Toda falha de login sai igual: mesma mensagem, mesmo status, mesma
         espera. Diferenciar "e-mail não existe" de "senha errada" entrega a
         lista de quem tem conta pra quem estiver sondando. */
      const recusar = async () => {
        await esperar(800);
        return NextResponse.json({ erro: "e-mail ou senha incorretos" }, { status: 401 });
      };

      if (!email || !senha) return recusar();

      const usuario = await loginSenha(email, senha);
      if (!usuario) return recusar();

      /* Admin é quem tem app_metadata.role = "admin". Só o servidor grava
         app_metadata, então o cliente não consegue forjar. ADMIN_EMAIL segue
         como alternativa opcional. */
      const adminEmail = String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
      const meta = usuario.app_metadata as { role?: string } | undefined;
      const ehAdmin = meta?.role === "admin" || (!!adminEmail && email === adminEmail);
      if (!ehAdmin) return recusar();

      const token = await assinar({ sub: "estudio", role: "admin", email }, SESSAO_SEGUNDOS);
      await gravarCookie(token, SESSAO_SEGUNDOS);
      return NextResponse.json({ ok: true, role: "admin" });
    }

    if (acao === "recuperar") {
      const email = String(corpo.email ?? "").trim().toLowerCase();
      /* Resposta sempre idêntica, com e sem e-mail e exista ou não a conta:
         é o que impede usar esta rota pra descobrir quem é cadastrado. */
      if (email) {
        const origem = req.headers.get("origin") ?? "https://" + (req.headers.get("host") ?? "");
        try { await recuperarSenha(email, origem + "/painel"); }
        catch (e) { console.error("recuperar falhou:", (e as Error).message); }
      }
      await esperar(500);
      return NextResponse.json({ ok: true });
    }

    if (acao === "trocar-senha") {
      const sessao = await sessaoAtual("admin");
      if (!sessao) return NextResponse.json({ erro: "sua sessão expirou, entre de novo" }, { status: 401 });
      if (!sessao.email) {
        return NextResponse.json({ erro: "saia e entre de novo pra poder trocar a senha" }, { status: 409 });
      }
      const atual = String(corpo.atual ?? "");
      const nova = String(corpo.nova ?? "");
      if (!atual || !nova) return NextResponse.json({ erro: "preencha a senha atual e a nova" }, { status: 400 });
      if (nova.length < 8) return NextResponse.json({ erro: "a nova senha precisa de pelo menos 8 caracteres" }, { status: 400 });
      if (nova === atual) return NextResponse.json({ erro: "a nova senha precisa ser diferente da atual" }, { status: 400 });

      /* e-mail vem do TOKEN, nunca do corpo: senão daria pra apontar a troca
         pra outra conta mandando outro e-mail no pedido */
      const trocou = await trocarSenha(sessao.email, atual, nova);
      if (!trocou) {
        await esperar(800);
        return NextResponse.json({ erro: "senha atual incorreta" }, { status: 401 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: "ação desconhecida" }, { status: 400 });
  } catch (e) {
    console.error("sessao falhou:", (e as Error).message);
    return NextResponse.json({ erro: "erro de configuração no servidor" }, { status: 500 });
  }
}
