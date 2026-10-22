/*
  Formulário de fechamento, /cadastro. Portado de `cadastro.html` do estúdio
  do Jordan Santos. Tela que o CLIENTE do fotógrafo abre: sem AppShell, e a
  voz é a do estúdio falando em primeira pessoa do plural.

  Página AUTÔNOMA: não recebe nada da proposta (/proposta), não sabe de preço.
  Quem escolhe pacote/adicionais é o fotógrafo, depois, no painel. O
  fotógrafo manda o link direto (WhatsApp, depois de uma conversa), do mesmo
  jeito que manda o link de assinatura do contrato.

  Envia pra /api/orcamento, que cria o CLIENTE direto (status "novo", sem
  itens/total) e avisa o fotógrafo por e-mail.

  Decisões herdadas do original:
  - Basta UMA das duas pessoas (2026-08-08). Quem entrar, entra com nome; o
    CPF é opcional (2026-08-11), mas se vier tem que estar completo.
  - Bairro/cidade/estado ficam sempre visíveis; o CEP (ViaCEP) só adianta o
    preenchimento, os campos continuam editáveis à mão.
  - WhatsApp com DDI via intl-tel-input. Na versão nova (29) o próprio plugin
    formata enquanto digita (formatAsYouType, com os utils carregados), o que
    substitui a máscara manual de número BR que o original aplicava.
  - Clique em campo de data/hora abre o picker: o padrão nativo só abre pelo
    iconezinho da direita, o resto do campo fica "morto".

  Desde 22/10/2026 o texto, o "aparece" e o "obrigatório" de cada campo vêm
  da config que o fotógrafo edita em /painel/formulario, e ele pode criar
  perguntas suas (regras em lib/formulario.ts). A rota confere de novo com a
  mesma config: o que esta tela exige é conveniência, quem manda é o servidor.
  Campo escondido vira par de uma coluna só: a linha de dois (CEP + número,
  bairro + cidade...) só existe quando os dois aparecem.
*/
"use client";

import {
  useCallback, useEffect, useRef, useState,
  type ChangeEvent, type FormEvent, type InputHTMLAttributes, type MouseEvent, type ReactNode, type Ref,
} from "react";
import type { Iti } from "intl-tel-input";
import "intl-tel-input/dist/css/intlTelInput.css";
import { fonteSans, fonteSerif } from "@/lib/fontes-marca";
import {
  campoExigido, erroDaResposta, perguntasVisiveis, TITULO_SECAO,
  type CampoFixoId, type Formulario, type Pergunta, type SecaoFormulario,
} from "@/lib/formulario";

type CampoId = CampoFixoId;

/* o WhatsApp fica fora do estado: o intl-tel-input é dono do valor do input
   (formata enquanto digita), então ele é lido direto do plugin na hora de
   validar e enviar */
type CampoControlado = Exclude<CampoId, "contato">;
type Valores = Record<CampoControlado, string>;

const VAZIO: Valores = {
  noivo: "", noiva: "", cpfNoivo: "", cpfNoiva: "", email: "",
  cep: "", numero: "", endereco: "", complemento: "", bairro: "", cidade: "", estado: "",
  data: "", horario: "", local: "",
};

/* `campo` é o id de um campo fixo ou de uma pergunta nova ("p_...") */
type Erro = { campo: string; msg: string } | null;

type RespostaViaCep = { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };

function soDigitos(v: string): string { return v.replace(/\D/g, ""); }

/* máscara por padrão ("9" = dígito, o resto é literal), mesma do original */
function mascarar(valor: string, padrao: string): string {
  const digitos = soDigitos(valor);
  let out = "";
  let di = 0;
  for (let i = 0; i < padrao.length && di < digitos.length; i++) {
    if (padrao[i] === "9") { out += digitos[di]; di++; }
    else out += padrao[i];
  }
  return out;
}
const MASCARAS: Partial<Record<CampoControlado, string>> = {
  cpfNoivo: "999.999.999-99",
  cpfNoiva: "999.999.999-99",
  cep: "99999-999",
};

/* clique em input de data/hora abre o picker. Só no click (mouse/touch, não
   em Tab), então quem navega por teclado ainda ganha foco sem picker. */
function abrirPicker(ev: MouseEvent<HTMLInputElement>) {
  const alvo = ev.currentTarget;
  if (typeof alvo.showPicker !== "function") return;
  try { alvo.showPicker(); } catch { /* Firefox exige gesto de usuário; clique é gesto, mas fica de rede */ }
}

/* ---------- CSS ----------
   Portado do original com as regras da casa aplicadas: campo é fundo (soft)
   e não borda; estado inválido é fundo avermelhado; foco muda o fundo, sem
   anel. As fontes vêm das variáveis do next/font aplicadas na raiz. */
const CSS = `
.cad{
  --sat:env(safe-area-inset-top,0px);--sab:env(safe-area-inset-bottom,0px);
  --paper:#FFFFFF;--ink:#1D1D1B;--ink-soft:#706F6F;--accent:#003646;--accent-deep:#4F6278;--noir:#1D1D1B;
  --line:#E8E1DC;--soft:#F6F3F0;--soft-foco:#EFEBE7;--erro:#A33B3B;--erro-tint:#FBEFEF;
  --sombra:0 10px 34px rgba(29,29,27,.14);
  --serif:var(--fonte-serif),"Didot",Georgia,serif;
  --sans:var(--fonte-sans),"Helvetica Neue",sans-serif;
  min-height:100dvh;background:var(--paper);color:var(--ink);font-family:var(--sans);
  font-weight:300;font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased;touch-action:manipulation;
}
.cad *{margin:0;padding:0;box-sizing:border-box}
.cad [hidden]{display:none !important}
.cad button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.cad .pagina{max-width:520px;margin:0 auto;padding:calc(38px + var(--sat)) 22px calc(48px + var(--sab))}
.cad .dica{display:inline-block;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);background:var(--soft);border-radius:999px;padding:6px 14px}
.cad h1{font-family:var(--serif);font-weight:500;font-size:30px;line-height:1.25;color:var(--accent);margin:14px 0 0}
.cad .sub{color:var(--ink-soft);font-size:14.5px;line-height:1.55;margin-top:12px}
.cad form{margin-top:30px}
.cad .form-secao{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);margin:26px 0 10px}
.cad .form-secao:first-of-type{margin-top:0}
.cad .ajuda-secao{font-size:12.5px;line-height:1.5;color:var(--ink-soft);margin:-4px 0 14px}
.cad .campo{display:block;font-size:12.5px;letter-spacing:.04em;color:var(--ink-soft);margin-bottom:16px}
.cad .campo .opc{text-transform:none;letter-spacing:0;opacity:.7}
.cad .campo input{
  display:block;width:100%;margin-top:7px;padding:12px 14px;height:50px;
  font-family:inherit;font-size:16px;font-weight:400;color:var(--ink);
  background:var(--soft);border:0;border-radius:10px;-webkit-appearance:none;appearance:none;
  transition:background .15s ease;
}
.cad .campo input::placeholder,.cad .campo textarea::placeholder{color:var(--ink-soft);opacity:.6}
.cad .campo input:focus,.cad .campo input:focus-visible{outline:none;background:var(--soft-foco)}
/* parágrafo e escolha (perguntas novas) seguem o mesmo campo: fundo, sem borda */
.cad .campo textarea,.cad .campo select{
  display:block;width:100%;margin-top:7px;padding:12px 14px;
  font-family:inherit;font-size:16px;font-weight:400;color:var(--ink);line-height:1.5;
  background:var(--soft);border:0;border-radius:10px;-webkit-appearance:none;appearance:none;
  transition:background .15s ease;
}
.cad .campo textarea{min-height:110px;resize:vertical}
.cad .campo select{height:50px;padding-right:40px;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23706F6F' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center}
.cad .campo select.vazio{color:rgba(112,111,111,.6)}
.cad .campo textarea:focus,.cad .campo select:focus{outline:none;background-color:var(--soft-foco)}
.cad .campo-invalido textarea,.cad .campo-invalido select{background-color:var(--erro-tint)}
/* <input type=date|time> é controle NATIVO: calcula a própria altura e desenha
   o valor num shadow element que não herda alinhamento nem margem. Altura
   fixa (acima) é o único jeito determinístico de igualar aos vizinhos. */
.cad .campo input[type="date"],.cad .campo input[type="time"]{text-align:left}
.cad .campo input[type="date"]::-webkit-date-and-time-value,.cad .campo input[type="time"]::-webkit-date-and-time-value{text-align:left;margin:0}
.cad .campo input[type="date"]::-webkit-datetime-edit,.cad .campo input[type="time"]::-webkit-datetime-edit{padding:0}
.cad .campo-linha{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.cad .campo-linha .campo{margin-bottom:0}
@media (max-width:480px){.cad .campo-linha{grid-template-columns:1fr}}
.cad .campo-cep{position:relative}
.cad .cep-status{position:absolute;right:14px;top:34px;font-size:11px;color:var(--ink-soft)}
.cad .campo-invalido input{background:var(--erro-tint)}
.cad .campo-erro-msg{display:block;color:var(--erro);font-size:11.5px;margin-top:5px;letter-spacing:0}

/* intl-tel-input: o plugin embrulha o input num .iti; o resto é deixar o
   dropdown (que vai pro body) na cara do resto da tela: fundo mais sombra */
.cad .campo .iti{width:100%;margin-top:7px;display:block}
.cad .campo .iti input{margin-top:0}
.cad .iti__selected-country{border:0;background:none}
.cad .iti__selected-country-primary{border-radius:10px 0 0 10px}
@media (hover:hover){.cad .iti__selected-country-primary:hover{background:var(--soft-foco)}}
.iti__country-selector{font-family:var(--fonte-sans),"Helvetica Neue",sans-serif;font-size:14px;border:0;border-radius:12px;box-shadow:0 10px 34px rgba(29,29,27,.14);background:#FFFFFF;z-index:200}
.iti__search-input{border:0;background:#F6F3F0;border-radius:8px;font:inherit;outline:none}
.iti__country.iti__highlight{background:#F6F3F0}

.cad .cta{
  display:block;width:100%;margin-top:34px;padding:19px 24px;
  background:var(--noir);color:#fff;text-align:center;text-decoration:none;
  font-size:13px;letter-spacing:.22em;text-transform:uppercase;border-radius:999px;
  transition:opacity .2s ease,background .2s ease;
}
@media (hover:hover){.cad .cta:hover{opacity:.85}}
.cad .cta:focus-visible{outline:none;background:#333331}
.cad .cta:disabled{opacity:.5;pointer-events:none}
.cad .erro{color:var(--erro);font-size:13.5px;text-align:center;margin-top:14px;min-height:18px}
.cad .sucesso{text-align:center;padding:60px 0}
.cad .sucesso h1{font-size:32px}
.cad .sucesso .cta{margin-top:34px}

/* iOS dá zoom ao focar campo com fonte menor que 16px e não desfaz sozinho.
   !important de propósito: é contorno de comportamento, tem que ganhar. */
@media (max-width:820px){.cad input,.cad select,.cad textarea{font-size:16px !important}}
`;


/* ---------- campo ---------- */

type PropsCampo = InputHTMLAttributes<HTMLInputElement> & {
  id: CampoId;
  rotulo: string;
  opcional?: boolean;
  erro: Erro;
  inputRef: Ref<HTMLInputElement>;
  classe?: string;
  extra?: ReactNode;
};

function CampoTexto({ id, rotulo, opcional, erro, inputRef, classe = "", extra, ...props }: PropsCampo) {
  const invalido = erro?.campo === id;
  return (
    <label className={"campo " + classe + (invalido ? " campo-invalido" : "")}>
      {rotulo}{opcional ? <> <span className="opc">(opcional)</span></> : null}
      <input ref={inputRef} id={"o-" + id} {...props} />
      {extra}
      {invalido ? <span className="campo-erro-msg">{erro.msg}</span> : null}
    </label>
  );
}

/** Dois campos lado a lado quando os dois aparecem; senão, o que sobrou sozinho. */
function Par({ a, b }: { a: ReactNode; b: ReactNode }) {
  if (a && b) return <div className="campo-linha">{a}{b}</div>;
  return <>{a}{b}</>;
}

type ElementoCampo = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Pergunta criada pelo fotógrafo, no tipo que ele escolheu. */
function CampoPergunta({
  p, valor, erro, aoMudar, elRef,
}: {
  p: Pergunta;
  valor: string;
  erro: Erro;
  aoMudar: (v: string) => void;
  elRef: (el: ElementoCampo | null) => void;
}) {
  const invalido = erro?.campo === p.id;
  const id = "o-" + p.id;
  let controle: ReactNode;
  if (p.tipo === "paragrafo") {
    controle = <textarea ref={elRef} id={id} placeholder={p.placeholder || undefined} value={valor}
      onChange={(e) => aoMudar(e.target.value)} />;
  } else if (p.tipo === "escolha") {
    controle = (
      <select ref={elRef} id={id} value={valor} className={valor ? "" : "vazio"} onChange={(e) => aoMudar(e.target.value)}>
        <option value="">Selecione</option>
        {p.opcoes.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else {
    controle = (
      <input ref={elRef} id={id}
        type={p.tipo === "data" ? "date" : "text"}
        inputMode={p.tipo === "numero" ? "decimal" : undefined}
        placeholder={p.placeholder || undefined}
        value={valor}
        onClick={p.tipo === "data" ? abrirPicker : undefined}
        onChange={(e) => aoMudar(e.target.value)} />
    );
  }
  return (
    <label className={"campo" + (invalido ? " campo-invalido" : "")}>
      {p.rotulo}{p.obrigatorio ? null : <> <span className="opc">(opcional)</span></>}
      {controle}
      {invalido ? <span className="campo-erro-msg">{erro.msg}</span> : null}
    </label>
  );
}

/* ============================================================ */

export function FormularioCadastro({ formulario }: { formulario: Formulario }) {
  const [valores, setValores] = useState<Valores>(VAZIO);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<Erro>(null);
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [cepStatus, setCepStatus] = useState("");

  const camposRef = useRef<Partial<Record<string, ElementoCampo | null>>>({});
  const itiRef = useRef<Iti | null>(null);
  const ultimoCepRef = useRef("");

  const registrar = useCallback((id: string) => (el: ElementoCampo | null) => {
    camposRef.current[id] = el;
  }, []);

  const cfg = formulario.campos;
  const aparece = (id: CampoId) => cfg[id].visivel;
  /* "(opcional)" só em campo que o fotógrafo deixou opcional. Nomes e CPF
     seguem a regra do par, explicada no texto da seção. */
  const opcional = (id: CampoId) => cfg[id].visivel && !cfg[id].obrigatorio && id !== "noivo" && id !== "noiva" &&
    id !== "cpfNoivo" && id !== "cpfNoiva";
  const perguntas = perguntasVisiveis(formulario);
  const perguntasDa = (secao: SecaoFormulario) => perguntas.filter((p) => p.secao === secao);

  /* ---------- WhatsApp com DDI ----------
     Import dinâmico: o plugin mexe em document ao carregar, e este componente
     é renderizado no servidor antes de hidratar. */
  useEffect(() => {
    const input = camposRef.current.contato as HTMLInputElement | null | undefined;
    if (!input) return;
    let vivo = true;
    let iti: Iti | null = null;
    void import("intl-tel-input").then(({ default: intlTelInput }) => {
      if (!vivo) return;
      iti = intlTelInput(input, {
        initialCountry: "br",
        countryOrder: ["br", "us", "pt", "ar", "py", "es", "it"],
        separateDialCode: true,
        dropdownParent: document.body,
        loadUtils: () => import("intl-tel-input/utils"),
      });
      itiRef.current = iti;
    });
    return () => {
      vivo = false;
      iti?.destroy();
      itiRef.current = null;
    };
  }, []);

  function valorContato(): string {
    const input = camposRef.current.contato;
    const iti = itiRef.current;
    if (iti) {
      const completo = (iti.getNumber() || "").trim();
      if (completo) return completo;
      const nac = (input?.value ?? "").trim();
      if (!nac) return "";
      const pais = iti.getSelectedCountry();
      return pais && pais.dialCode ? "+" + pais.dialCode + " " + nac : nac;
    }
    return (input?.value ?? "").trim();
  }

  /* ---------- endereço via ViaCEP (gratuito, sem chave) ---------- */
  function buscarCep(v: string) {
    const cep = soDigitos(v);
    if (cep.length !== 8 || cep === ultimoCepRef.current) return;
    ultimoCepRef.current = cep;
    setCepStatus("Buscando...");
    fetch("https://viacep.com.br/ws/" + cep + "/json/")
      .then((r) => r.json() as Promise<RespostaViaCep>)
      .then((j) => {
        setCepStatus("");
        if (j.erro) return;
        setValores((a) => ({
          ...a,
          endereco: a.endereco || (j.logradouro || ""),
          bairro: j.bairro || "",
          cidade: j.localidade || "",
          estado: j.uf || "",
        }));
        camposRef.current.numero?.focus();
      })
      .catch(() => setCepStatus(""));
  }

  /* um handler só pra todos os campos controlados: o id do campo vem do
     próprio input ("o-<id>"), então nada é criado durante o render */
  function aoMudar(ev: ChangeEvent<HTMLInputElement>) {
    const id = ev.target.id.replace(/^o-/, "") as CampoControlado;
    const mascara = MASCARAS[id];
    const v = mascara ? mascarar(ev.target.value, mascara) : ev.target.value;
    setValores((a) => ({ ...a, [id]: v }));
    if (erro && erro.campo === id) setErro(null);
    if (id === "cep") buscarCep(v);
  }

  function mudarResposta(id: string, v: string) {
    setRespostas((a) => ({ ...a, [id]: v }));
    if (erro && erro.campo === id) setErro(null);
  }

  /* ---------- validação ---------- */
  function marcarErro(campo: string, msg: string) {
    setErro({ campo, msg });
    const el = camposRef.current[campo];
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => el.focus(), 280);
  }

  /* Contratantes: basta UM, mas quem entrar tem que vir com nome; o CPF é
     opcional e, se vier, completo (meio CPF no contrato é pior do que
     nenhum). Regra sobre o par, não sobre um campo isolado, por isso roda
     antes da lista. */
  function validarContratantes(): boolean {
    const pessoas = ([
      { rotulo: "do noivo", nome: "noivo", cpf: "cpfNoivo" },
      { rotulo: "da noiva", nome: "noiva", cpf: "cpfNoiva" },
    ] as const).map((p) => ({ p, nome: valores[p.nome].trim(), cpf: soDigitos(valores[p.cpf]) }));

    if (pessoas.every((x) => !x.nome)) {
      marcarErro("noivo", "Preencha o nome de ao menos um contratante.");
      return false;
    }
    for (const x of pessoas) {
      if (x.cpf && x.cpf.length !== 11) {
        marcarErro(x.p.cpf, "Confira o CPF " + x.p.rotulo + " (11 dígitos) ou deixe em branco.");
        return false;
      }
      if (x.cpf && !x.nome) {
        marcarErro(x.p.nome, "Preencha o nome " + x.p.rotulo + " ou apague o CPF.");
        return false;
      }
    }
    return true;
  }

  function validarFormulario(): boolean {
    setErro(null);
    if (!validarContratantes()) return false;
    const v = (id: CampoControlado) => valores[id].trim();
    /* `ok` é a regra do campo PREENCHIDO; vazio só é erro quando o fotógrafo
       deixou o campo obrigatório (e aparecendo) */
    const regras: { campo: CampoId; valor: string; ok: boolean; vazio: string; invalido?: string }[] = [
      { campo: "contato", valor: valorContato(), ok: true, vazio: "Preencha o WhatsApp." },
      { campo: "email", valor: v("email"), ok: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email")), vazio: "Digite um e-mail válido.", invalido: "Digite um e-mail válido." },
      { campo: "cep", valor: v("cep"), ok: soDigitos(v("cep")).length === 8, vazio: "Confira o CEP (8 dígitos).", invalido: "Confira o CEP (8 dígitos)." },
      { campo: "numero", valor: v("numero"), ok: true, vazio: "Preencha o número." },
      { campo: "endereco", valor: v("endereco"), ok: true, vazio: "Preencha o endereço." },
      { campo: "bairro", valor: v("bairro"), ok: true, vazio: "Preencha o bairro." },
      { campo: "cidade", valor: v("cidade"), ok: true, vazio: "Preencha a cidade." },
      { campo: "estado", valor: v("estado"), ok: true, vazio: "Preencha o estado." },
      { campo: "data", valor: v("data"), ok: true, vazio: "Escolha a data do casamento." },
      { campo: "horario", valor: v("horario"), ok: true, vazio: "Escolha o horário." },
      { campo: "local", valor: v("local"), ok: true, vazio: "Preencha o local do evento." },
    ];
    for (const r of regras) {
      if (!aparece(r.campo)) continue;
      if (!r.valor) {
        if (campoExigido(formulario, r.campo)) { marcarErro(r.campo, r.vazio); return false; }
        continue;
      }
      if (!r.ok) { marcarErro(r.campo, r.invalido ?? r.vazio); return false; }
    }
    for (const p of perguntas) {
      const msg = erroDaResposta(p, (respostas[p.id] ?? "").trim());
      if (msg) { marcarErro(p.id, msg); return false; }
    }
    return true;
  }

  /* ---------- envio ---------- */
  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErroGeral("");
    if (!validarFormulario()) return;
    setEnviando(true);
    const v = (id: CampoControlado) => valores[id].trim();
    try {
      const r = await fetch("/api/orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noivo: v("noivo"),
          noiva: v("noiva"),
          cpfNoivo: soDigitos(v("cpfNoivo")),
          cpfNoiva: soDigitos(v("cpfNoiva")),
          contato: valorContato(),
          email: v("email"),
          cep: soDigitos(v("cep")),
          endereco: v("endereco"),
          numero: v("numero"),
          complemento: v("complemento"),
          bairro: v("bairro"),
          cidade: v("cidade"),
          estado: v("estado"),
          dataEvento: v("data"),
          horario: v("horario"),
          local: v("local"),
          respostas: Object.fromEntries(perguntas.map((p) => [p.id, (respostas[p.id] ?? "").trim()])),
          /* sem itens/total: o fotógrafo escolhe o pacote/adicionais depois,
             no painel. A rota trata a ausência disso de propósito. */
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(j.erro || "falha");
      setEnviado(true);
      window.scrollTo(0, 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "falha";
      setErroGeral(msg === "falha" ? "Não deu pra enviar agora. Tente de novo em instantes." : msg);
    } finally {
      setEnviando(false);
    }
  }

  const contatoInvalido = erro?.campo === "contato";

  /* campo fixo pronto pra desenhar, ou null quando o fotógrafo escondeu */
  function fixo(id: CampoControlado, props: Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & { classe?: string; extra?: ReactNode } = {}) {
    if (!aparece(id)) return null;
    return (
      <CampoTexto id={id} rotulo={cfg[id].rotulo} opcional={opcional(id)} erro={erro} inputRef={registrar(id)}
        type="text" placeholder={cfg[id].placeholder || undefined} value={valores[id]} onChange={aoMudar} {...props} />
    );
  }

  function extras(secao: SecaoFormulario) {
    return perguntasDa(secao).map((p) => (
      <CampoPergunta key={p.id} p={p} valor={respostas[p.id] ?? ""} erro={erro}
        aoMudar={(val) => mudarResposta(p.id, val)} elRef={registrar(p.id)} />
    ));
  }

  const ajudaContratantes = "Se só um de vocês vai assinar, preencha só os dados dele." +
    (aparece("cpfNoivo") || aparece("cpfNoiva") ? " O CPF é opcional: se não tiver, pode deixar em branco." : "");
  const temEndereco = (["cep", "numero", "endereco", "complemento", "bairro", "cidade", "estado"] as const).some(aparece) ||
    perguntasDa("endereco").length > 0;

  return (
    <main className={`cad ${fonteSerif.variable} ${fonteSans.variable}`}>
      <style>{CSS}</style>
      <div className="pagina">
        {enviado ? (
          <div className="sucesso">
            <h1>Recebido!</h1>
            <p className="sub">Vamos revisar seus dados e já mandamos o contrato pra você assinar. Será uma honra eternizar esse momento.</p>
            <a className="cta" href="/proposta">Voltar pro início</a>
          </div>
        ) : (
          <div>
            <span className="dica">Cadastro</span>
            <h1>Vamos confirmar nossa data</h1>
            <p className="sub">Preencha os dados de quem vai assinar o contrato. Assim que confirmarmos, já mandamos o contrato pra você assinar.</p>

            <form onSubmit={(ev) => void enviar(ev)} noValidate>
              <div className="form-secao">{TITULO_SECAO.assinar}</div>
              <p className="ajuda-secao">{ajudaContratantes}</p>
              {fixo("noivo", { autoComplete: "given-name" })}
              {fixo("noiva", { autoComplete: "given-name" })}
              <Par a={fixo("cpfNoivo", { inputMode: "numeric" })} b={fixo("cpfNoiva", { inputMode: "numeric" })} />

              {/* o input do WhatsApp fica num <div> próprio: o intl-tel-input
                  embrulha o input num .iti, e o React nunca precisa mexer nos
                  filhos desse div */}
              <label className={"campo" + (contatoInvalido ? " campo-invalido" : "")}>
                {cfg.contato.rotulo}
                <div>
                  <input
                    ref={registrar("contato")}
                    id="o-contato"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    defaultValue=""
                    onInput={() => { if (contatoInvalido) setErro(null); }}
                  />
                </div>
                {contatoInvalido ? <span className="campo-erro-msg">{erro.msg}</span> : null}
              </label>

              {fixo("email", { type: "email", autoComplete: "email" })}
              {extras("assinar")}

              {temEndereco ? <div className="form-secao">{TITULO_SECAO.endereco}</div> : null}
              <Par
                a={fixo("cep", {
                  classe: "campo-cep", inputMode: "numeric", autoComplete: "postal-code",
                  extra: <span className="cep-status">{cepStatus}</span>,
                })}
                b={fixo("numero", { inputMode: "numeric", autoComplete: "address-line2" })}
              />
              {fixo("endereco", { autoComplete: "address-line1" })}
              {fixo("complemento")}
              <Par a={fixo("bairro", { autoComplete: "address-level3" })} b={fixo("cidade", { autoComplete: "address-level2" })} />
              {fixo("estado", { inputMode: "text", maxLength: 2, autoComplete: "address-level1" })}
              {extras("endereco")}

              <div className="form-secao">{TITULO_SECAO.evento}</div>
              <Par
                a={fixo("data", { type: "date", onClick: abrirPicker })}
                b={fixo("horario", { type: "time", onClick: abrirPicker })}
              />
              {fixo("local")}
              {extras("evento")}

              {perguntasDa("extra").length ? <div className="form-secao">{TITULO_SECAO.extra}</div> : null}
              {extras("extra")}

              <button className="cta" type="submit" disabled={enviando}>
                {enviando ? "Confirmando..." : "Confirmar nossa data"}
              </button>
              <p className="erro" role="alert">{erroGeral}</p>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
