/*
  Configurações num modal (22/10/2026, pedido do Ricardo), no molde do modal
  de configurações do Nexus Hub: tamanho fixo (1040 x 720, encolhendo com a
  tela), barra lateral com busca e as seções agrupadas, e o conteúdo rolando
  por dentro, à direita. Antes era a página /painel/configuracoes, com um
  cartão por assunto um embaixo do outro.

  No estúdio a barra fica no cinza da lateral do editor do contrato
  (#ECEEF1) e o conteúdo no papel, arredondado do lado da barra.

  No celular vira tela cheia: título e fechar em cima, as seções viram uma
  fileira de abas que rola de lado, e o conteúdo rola embaixo.

  O conteúdo (perfil, localização, segurança) é o mesmo da página de antes,
  portado de configuracoes.html: o e-mail é identidade do login e não campo
  editável (trocar exige confirmação por e-mail no Auth).
*/
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Lock, MapPin, Search, Shield, User, X, type LucideIcon } from "lucide-react";
import { Botao, Campo, Estado } from "@/components/ui";
import { abrirConfiguracoes, fecharConfiguracoes, useSecaoConfig, type SecaoConfig } from "@/lib/configuracoes-modal";

type Msg = { texto: string; tom?: "ok" | "erro" };

async function api<T = unknown>(url: string, corpo?: unknown): Promise<T> {
  const r = await fetch(url, corpo
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }
    : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro ?? "falha");
  return j as T;
}

type Item = { id: SecaoConfig; rotulo: string; descricao: string; Icone: LucideIcon; busca: string[] };
const GRUPOS: { rotulo: string; itens: Item[] }[] = [
  {
    rotulo: "Conta",
    itens: [
      { id: "perfil", rotulo: "Perfil", descricao: "Como você aparece dentro do estúdio.", Icone: User, busca: ["nome", "usuário", "e-mail"] },
      { id: "seguranca", rotulo: "Segurança", descricao: "A senha que você usa pra entrar no estúdio.", Icone: Shield, busca: ["senha", "redefinir"] },
    ],
  },
  {
    rotulo: "Estúdio",
    itens: [
      { id: "localizacao", rotulo: "Localização", descricao: "Sua cidade define a previsão do tempo que aparece na saudação da Home.", Icone: MapPin, busca: ["cidade", "tempo", "clima", "previsão"] },
    ],
  },
];
const ITENS = GRUPOS.flatMap((g) => g.itens);

const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Linha de ação do fim de cada seção: estado à esquerda do botão. */
function Acoes({ msg, children }: { msg: Msg; children: ReactNode }) {
  return (
    <div className="mt-2 flex items-center justify-end gap-3">
      <Estado texto={msg.texto} tom={msg.tom} />
      {children}
    </div>
  );
}

export function ModalConfiguracoes() {
  const secao = useSecaoConfig();
  const [busca, setBusca] = useState("");

  const [email, setEmail] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [cidade, setCidade] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [msgPerfil, setMsgPerfil] = useState<Msg>({ texto: "" });
  const [msgLoc, setMsgLoc] = useState<Msg>({ texto: "" });
  const [msgSenha, setMsgSenha] = useState<Msg>({ texto: "" });
  const [msgReset, setMsgReset] = useState<Msg>({ texto: "" });
  const [ocupado, setOcupado] = useState<string | null>(null);

  const aberto = secao !== null;

  /* lê os dados toda vez que abre (podem ter mudado em outra aba) */
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    api<{ ok: boolean; email?: string | null }>("/api/sessao").then((s) => { if (vivo) setEmail(s.email ?? null); }).catch(() => {});
    api<{ perfil?: { nome?: string; username?: string }; localizacao?: { cidade?: string } }>("/api/config")
      .then((cfg) => {
        if (!vivo) return;
        setNome(cfg.perfil?.nome ?? "");
        setUsername(cfg.perfil?.username ?? "");
        setCidade(cfg.localizacao?.cidade ?? "");
      }).catch(() => {});
    return () => { vivo = false; };
  }, [aberto]);

  /* Esc fecha; a página de trás não rola enquanto o modal está aberto */
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = antes; };
  }, [aberto]);

  function fechar() {
    fecharConfiguracoes();
    setBusca("");
  }

  async function salvarPerfil() {
    setOcupado("perfil"); setMsgPerfil({ texto: "Salvando…" });
    try {
      await api("/api/config", { acao: "salvar-perfil", perfil: { nome: nome.trim(), username: username.trim() } });
      setMsgPerfil({ texto: "Perfil salvo ✓", tom: "ok" });
    } catch (e) { setMsgPerfil({ texto: (e as Error).message || "Não consegui salvar.", tom: "erro" }); }
    finally { setOcupado(null); }
  }

  /* Geocoding pela Open-Meteo (grátis, sem chave). Aqui só resolve a cidade
     pra {cidade, nome, lat, lon}; a Home lê isso e busca o tempo. */
  async function salvarLocalizacao() {
    const q = cidade.trim();
    if (!q) { setMsgLoc({ texto: "Digite uma cidade.", tom: "erro" }); return; }
    setOcupado("loc"); setMsgLoc({ texto: "Procurando…" });
    try {
      const u = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(q) + "&count=1&language=pt&format=json";
      const d = await (await fetch(u)).json() as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] };
      const res = d.results?.[0];
      if (!res) { setMsgLoc({ texto: "Não achei essa cidade, tente escrever de outro jeito.", tom: "erro" }); return; }
      const loc = { cidade: res.name, nome: [res.name, res.admin1, res.country].filter(Boolean).join(", "), lat: res.latitude, lon: res.longitude };
      await api("/api/config", { acao: "salvar-localizacao", localizacao: loc });
      setCidade(res.name);
      setMsgLoc({ texto: "Salvo: " + loc.nome + " ✓", tom: "ok" });
    } catch (e) { setMsgLoc({ texto: (e as Error).message || "Falha ao procurar a cidade, tente de novo.", tom: "erro" }); }
    finally { setOcupado(null); }
  }

  async function trocarSenha() {
    if (!senhaAtual || !senhaNova) { setMsgSenha({ texto: "Preencha a senha atual e a nova.", tom: "erro" }); return; }
    if (senhaNova.length < 8) { setMsgSenha({ texto: "A nova senha precisa de pelo menos 8 caracteres.", tom: "erro" }); return; }
    if (senhaNova === senhaAtual) { setMsgSenha({ texto: "A nova senha precisa ser diferente da atual.", tom: "erro" }); return; }
    setOcupado("senha"); setMsgSenha({ texto: "Trocando…" });
    try {
      await api("/api/sessao", { acao: "trocar-senha", atual: senhaAtual, nova: senhaNova });
      setSenhaAtual(""); setSenhaNova("");
      setMsgSenha({ texto: "Senha trocada ✓", tom: "ok" });
    } catch (e) { setMsgSenha({ texto: (e as Error).message || "Não consegui trocar a senha.", tom: "erro" }); }
    finally { setOcupado(null); }
  }

  async function enviarReset() {
    if (!email) { setMsgReset({ texto: "Saia e entre de novo pra usar esta opção.", tom: "erro" }); return; }
    setOcupado("reset"); setMsgReset({ texto: "Enviando…" });
    try {
      await api("/api/sessao", { acao: "recuperar", email });
      setMsgReset({ texto: "Link de redefinição enviado pro e-mail da conta.", tom: "ok" });
    } catch { setMsgReset({ texto: "Não consegui enviar agora, tente de novo.", tom: "erro" }); }
    finally { setOcupado(null); }
  }

  if (!aberto || typeof document === "undefined") return null;

  const termo = normalizar(busca.trim());
  const grupos = GRUPOS.map((g) => ({
    ...g,
    itens: g.itens.filter((i) => !termo || [i.rotulo, i.descricao, ...i.busca].some((t) => normalizar(t).includes(termo))),
  })).filter((g) => g.itens.length);
  const ativo = ITENS.find((i) => i.id === secao) ?? ITENS[0];

  const conteudo: Record<SecaoConfig, ReactNode> = {
    perfil: (
      <>
        {email ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-[10px] bg-soft px-3.5 py-3">
            <span className="text-[12.5px] font-medium text-ink-soft">E-mail da conta</span>
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink"><Lock size={13} className="shrink-0 text-ink-soft" /><span className="truncate">{email}</span></span>
          </div>
        ) : null}
        <Campo id="perfil-nome" rotulo="Nome" placeholder="Seu nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo id="perfil-username" rotulo="Nome de usuário" placeholder="@usuario" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Acoes msg={msgPerfil}><Botao onClick={salvarPerfil} disabled={ocupado === "perfil"}>Salvar perfil</Botao></Acoes>
      </>
    ),
    localizacao: (
      <>
        <Campo id="loc-cidade" rotulo="Cidade" placeholder="Foz do Iguaçu" autoComplete="off" value={cidade} onChange={(e) => setCidade(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void salvarLocalizacao(); }} />
        <Acoes msg={msgLoc}><Botao onClick={salvarLocalizacao} disabled={ocupado === "loc"}>Salvar localização</Botao></Acoes>
      </>
    ),
    seguranca: (
      <>
        <Campo id="seg-atual" rotulo="Senha atual" type="password" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
        <Campo id="seg-nova" rotulo="Nova senha" type="password" autoComplete="new-password" placeholder="Pelo menos 8 caracteres" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} />
        <Acoes msg={msgSenha}><Botao onClick={trocarSenha} disabled={ocupado === "senha"}>Trocar senha</Botao></Acoes>

        {/* saída pra quem não lembra a atual; o e-mail vem da sessão, não
            de um campo: só existe uma conta e ela já está logada aqui */}
        <div className="my-6 h-px bg-soft" aria-hidden />
        <p className="m-0 text-[14px] font-semibold text-ink">Esqueceu a senha atual?</p>
        <p className="m-0 mt-1 text-[13px] text-ink-soft">Enviamos um link de redefinição pro e-mail da conta.</p>
        <Acoes msg={msgReset}><Botao variante="secundario" onClick={enviarReset} disabled={ocupado === "reset"}>Enviar link de redefinição</Botao></Acoes>
      </>
    ),
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center md:p-4" role="dialog" aria-modal="true" aria-label="Configurações">
      <div className="absolute inset-0 bg-[rgba(29,29,27,.5)] backdrop-blur-[2px]" onClick={fechar} />

      <div className="relative z-[1] flex h-dvh w-full flex-col overflow-hidden bg-[#ECEEF1] md:h-[min(720px,calc(100dvh-32px))] md:w-[min(1040px,calc(100vw-32px))] md:flex-row md:rounded-[22px] md:shadow-alta">
        {/* barra lateral: busca e seções (no celular, título + abas) */}
        <aside className="flex shrink-0 flex-col gap-3 p-3 pt-[calc(var(--sat)+12px)] md:w-60 md:gap-4 md:pt-3">
          <div className="flex items-center justify-between px-1 md:hidden">
            <span className="text-[22px] font-bold text-ink">Configurações</span>
            <button type="button" onClick={fechar} aria-label="Fechar"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft hover:bg-paper hover:text-ink">
              <X size={18} />
            </button>
          </div>
          <div className="relative hidden md:block">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar configurações" aria-label="Buscar configurações"
              onKeyDown={(e) => { if (e.key === "Enter" && grupos[0]?.itens[0]) abrirConfiguracoes(grupos[0].itens[0].id); }}
              className="h-9 w-full rounded-[10px] bg-paper pl-8 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-soft/80" />
          </div>
          <nav className="-mx-3 flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-col md:gap-4 md:overflow-y-auto md:px-0">
            {grupos.length === 0 ? <p className="px-2 text-[12.5px] text-ink-soft">Nada encontrado.</p> : null}
            {grupos.map((g) => (
              <div key={g.rotulo} className="flex shrink-0 gap-1 md:flex-col md:gap-0.5">
                <p className="m-0 hidden px-2 pb-1 text-[12px] font-medium text-ink-soft md:block">{g.rotulo}</p>
                {g.itens.map((i) => (
                  <button key={i.id} type="button" onClick={() => abrirConfiguracoes(i.id)}
                    className={"flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] px-3 text-left text-[13.5px] transition-colors md:h-8 md:px-2 " +
                      (i.id === ativo.id ? "bg-paper font-semibold text-ink" : "text-ink-soft hover:bg-paper/70 hover:text-ink")}>
                    <i.Icone size={16} strokeWidth={1.9} className="shrink-0" />
                    <span className="truncate">{i.rotulo}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* conteúdo da seção, rolando por dentro; arredondado do lado da barra */}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-paper [scrollbar-gutter:stable] max-md:rounded-t-[22px] md:rounded-l-[22px]">
          <button type="button" onClick={fechar} aria-label="Fechar"
            className="absolute right-4 top-4 hidden h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft hover:bg-soft hover:text-ink md:inline-flex">
            <X size={18} />
          </button>
          <div className="mx-auto max-w-[560px] px-5 pb-[calc(var(--sab)+32px)] pt-7 md:px-10 md:py-12">
            <h2 className="m-0 text-[24px] font-semibold tracking-tight text-ink">{ativo.rotulo}</h2>
            <p className="m-0 mt-1 text-[13.5px] text-ink-soft">{ativo.descricao}</p>
            <div className="mt-7">{conteudo[ativo.id]}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
