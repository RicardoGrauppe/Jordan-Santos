/*
  Configurações: perfil, localização e segurança. Portado de configuracoes.html
  (painel-config). Cada card explica a si mesmo; o e-mail é identidade do login
  e não campo editável (trocar exige confirmação por e-mail no Auth).
*/
"use client";

import { useEffect, useState } from "react";
import { Lock, MapPin, Shield, User } from "lucide-react";
import { Botao, BotaoVoltar, Campo, Cartao, Estado } from "@/components/ui";

type Msg = { texto: string; tom?: "ok" | "erro" };

async function api<T = unknown>(url: string, corpo?: unknown): Promise<T> {
  const r = await fetch(url, corpo
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }
    : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro ?? "falha");
  return j as T;
}

function TituloCard({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="m-0 mb-1 flex items-center gap-2.5 text-[15px] font-semibold text-ink">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent-tint text-accent">{icone}</span>
      {children}
    </h2>
  );
}

export default function Configuracoes() {
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

  useEffect(() => {
    api<{ ok: boolean; email?: string | null }>("/api/sessao").then((s) => setEmail(s.email ?? null)).catch(() => {});
    api<{ perfil?: { nome?: string; username?: string }; localizacao?: { cidade?: string } }>("/api/config")
      .then((cfg) => {
        setNome(cfg.perfil?.nome ?? "");
        setUsername(cfg.perfil?.username ?? "");
        setCidade(cfg.localizacao?.cidade ?? "");
      }).catch(() => {});
  }, []);

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

  return (
    <div className="mx-auto max-w-[640px]">
      {/* No original esta era uma página fora do estúdio e o topo dela existia
          só pra sair: a seta voltava pro /estudio com o menu da conta aberto.
          Aqui a moldura já fica em volta, mas o caminho de volta some no
          celular, onde não há lateral — daí a seta continuar. */}
      {/* no celular isto vive no cabeçalho (ver cabecalho-mobile.tsx) */}
      <div className="max-md:hidden">
        <BotaoVoltar href="/painel" rotulo="Home" />
        <h1 className="m-0 mb-6 text-[26px] font-bold text-ink">Configurações</h1>
      </div>

      <div className="flex flex-col gap-5">
        <Cartao>
          <TituloCard icone={<User size={16} />}>Perfil</TituloCard>
          <p className="m-0 mb-4 text-[13px] text-ink-soft">Como você aparece dentro do estúdio.</p>
          {email ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[10px] bg-soft px-3.5 py-3">
              <span className="text-[12.5px] font-medium text-ink-soft">E-mail da conta</span>
              <span className="flex items-center gap-1.5 text-sm text-ink"><Lock size={13} className="text-ink-soft" />{email}</span>
            </div>
          ) : null}
          <Campo id="perfil-nome" rotulo="Nome" placeholder="Seu nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Campo id="perfil-username" rotulo="Nome de usuário" placeholder="@usuario" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <div className="flex items-center justify-end gap-3">
            <Estado texto={msgPerfil.texto} tom={msgPerfil.tom} />
            <Botao onClick={salvarPerfil} disabled={ocupado === "perfil"}>Salvar perfil</Botao>
          </div>
        </Cartao>

        <Cartao>
          <TituloCard icone={<MapPin size={16} />}>Localização</TituloCard>
          <p className="m-0 mb-4 text-[13px] text-ink-soft">Sua cidade define a previsão do tempo que aparece na saudação da Home.</p>
          <Campo id="loc-cidade" rotulo="Cidade" placeholder="Ex.: Foz do Iguaçu" autoComplete="off" value={cidade} onChange={(e) => setCidade(e.target.value)} />
          <div className="flex items-center justify-end gap-3">
            <Estado texto={msgLoc.texto} tom={msgLoc.tom} />
            <Botao onClick={salvarLocalizacao} disabled={ocupado === "loc"}>Salvar localização</Botao>
          </div>
        </Cartao>

        <Cartao>
          <TituloCard icone={<Shield size={16} />}>Segurança</TituloCard>
          <p className="m-0 mb-4 text-[13px] text-ink-soft">Troque a senha que você usa pra entrar no estúdio.</p>
          <Campo id="seg-atual" rotulo="Senha atual" type="password" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
          <Campo id="seg-nova" rotulo="Nova senha" type="password" autoComplete="new-password" placeholder="Pelo menos 8 caracteres" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} />
          <div className="flex items-center justify-end gap-3">
            <Estado texto={msgSenha.texto} tom={msgSenha.tom} />
            <Botao onClick={trocarSenha} disabled={ocupado === "senha"}>Trocar senha</Botao>
          </div>

          {/* saída pra quem não lembra a atual; o e-mail vem da sessão, não
              de um campo: só existe uma conta e ela já está logada aqui */}
          <div className="my-5 h-px bg-soft" aria-hidden />
          <p className="m-0 mb-3 text-[13px] text-ink-soft">Não lembra a senha atual? Enviamos um link de redefinição pro e-mail da conta.</p>
          <div className="flex items-center justify-end gap-3">
            <Estado texto={msgReset.texto} tom={msgReset.tom} />
            <Botao variante="secundario" onClick={enviarReset} disabled={ocupado === "reset"}>Enviar link de redefinição</Botao>
          </div>
        </Cartao>
      </div>
    </div>
  );
}
