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

  Fluxo em ETAPAS (22/10/2026, brandbook seção 18): boas-vindas, uma etapa por
  seção (a "Conta pra gente" só se houver pergunta, "Endereço do contrato" só se
  sobrar campo), e revisão antes de enviar. Todas as etapas ficam MONTADAS e
  só a atual aparece: o intl-tel-input se prende ao input do WhatsApp na
  montagem e o perderia se a etapa desmontasse, e é assim também que o valor
  digitado sobrevive a ir e voltar. Trocar `hidden` reinicia a animação de
  CSS sozinho (elemento que volta a ser desenhado começa a animação do zero),
  então não precisa de `key` nem de remontar nada.
*/
"use client";

import {
  useCallback, useEffect, useRef, useState,
  type ChangeEvent, type FormEvent, type InputHTMLAttributes, type MouseEvent, type ReactNode, type Ref,
} from "react";
import { ArrowRight, CalendarHeart, Heart, Info, Pencil, Lightbulb, MapPin, MessageCircleHeart, UsersRound } from "lucide-react";
import type { Iti } from "intl-tel-input";
import "intl-tel-input/dist/css/intlTelInput.css";
import { fonteSans, fonteSerif } from "@/lib/fontes-marca";
import {
  campoExigido, erroDaResposta, exibirResposta, perguntasVisiveis, DEFINICAO, SECOES, TITULO_SECAO,
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
  data: "", horario: "", local: "", enderecoEvento: "",
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
/* no celular o botão das etapas fica na barra fixa (abaixo): a página ganha
   respiro do tamanho dela pra última linha não ficar escondida */
.cad .pagina.com-barra{padding-bottom:calc(120px + var(--sab))}
@media (min-width:768px){.cad .pagina.larga.com-barra{padding-bottom:calc(48px + var(--sab))}}
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
/* O reset ".cad *{margin:0;padding:0}" vence as regras do plugin (mesma
   especificidade, e este CSS vem depois) e zerava os espaços do seletor: a
   bandeira colava na borda e seta e DDI se amontoavam. Devolvidos aqui, com o
   recuo da esquerda igual ao do texto dos campos (14px). O DDI ganha o corpo
   do número digitado, senão herdava o 12,5px do rótulo. */
.cad .campo .iti__selected-country-primary{padding:0 7px 0 14px}
.cad .campo .iti__arrow{margin:-2px 0 0 7px}
.cad .campo .iti__arrow--up{margin-top:4px}
.cad .campo .iti__selected-dial-code{margin-left:6px;font-size:16px;font-weight:400;color:var(--ink)}
@media (hover:hover){.cad .iti__selected-country-primary:hover{background:var(--soft-foco)}}
.iti__country-selector{font-family:var(--fonte-sans),"Helvetica Neue",sans-serif;font-size:14px;border:0;border-radius:12px;box-shadow:0 10px 34px rgba(29,29,27,.14);background:#FFFFFF;z-index:200}
.iti__search-input{border:0;background:#F6F3F0;border-radius:8px;font:inherit;outline:none}
/* sem linha nenhuma no dropdown (regra da casa): o plugin põe 1px cinza em
   volta dele e outro embaixo da busca, com seletores mais fortes que o de
   cima. Quem separa é o fundo (busca bege, lista branca) e a sombra. */
.iti .iti__country-selector,.iti--inline-country-selector .iti__country-selector{
  border:0;border-radius:12px;overflow:hidden;box-shadow:0 10px 34px rgba(29,29,27,.14)}
.iti .iti__search-input-wrapper{border-bottom:0}
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

/* ---------- fluxo em etapas ---------- */
.cad{overflow-x:clip}
/* topo das etapas FIXO no alto da tela desde o começo (brandbook 18): só o
   corpo rola, por baixo dele. Era sticky e só grudava depois de rolar, com
   a página empurrando ele 38px pra baixo. Fixed funciona porque ele mora
   fora das etapas (que entram com transform e prenderiam um fixed). Ocupa a
   largura toda pra o fundo cobrir o que passa por baixo, e o recuo lateral
   centraliza o conteúdo na mesma coluna de 476px da página. A página ganha
   o respiro do tamanho dele (.pagina.com-topo). */
.cad .topo-etapa{display:flex;align-items:center;gap:12px;min-height:40px;
  position:fixed;top:0;left:0;right:0;z-index:40;
  padding:calc(14px + var(--sat)) max(22px, calc((100% - 476px) / 2)) 20px;
  background:linear-gradient(to bottom,var(--paper) 72%,rgba(255,255,255,0))}
.cad .pagina.com-topo{padding-top:calc(88px + var(--sat))}
.cad .voltar-etapa{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;color:var(--ink);flex-shrink:0;transition:background .15s ease}
@media (hover:hover){.cad .voltar-etapa:hover{background:var(--soft)}}
.cad .voltar-etapa:focus-visible{outline:none;background:var(--soft-foco)}
.cad .progresso-info{flex:1;min-width:0}
.cad .progresso-rotulo{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft)}
.cad .progresso{height:3px;border-radius:999px;background:var(--line);margin-top:8px;overflow:hidden}
.cad .progresso span{display:block;height:100%;border-radius:999px;background:var(--accent);transition:width .6s cubic-bezier(.22,1,.36,1)}
.cad .etapa{animation:cad-entra-frente .5s cubic-bezier(.22,1,.36,1) both}
.cad .etapa[data-dir="tras"]{animation-name:cad-entra-tras}
@keyframes cad-entra-frente{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:none}}
@keyframes cad-entra-tras{from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:none}}
.cad .etapa .sub{margin-bottom:28px}
.cad .etapa-corpo > *{animation:cad-sobe .55s cubic-bezier(.22,1,.36,1) both}
@keyframes cad-sobe{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.cad .etapa-corpo > :nth-child(1){animation-delay:90ms}
.cad .etapa-corpo > :nth-child(2){animation-delay:145ms}
.cad .etapa-corpo > :nth-child(3){animation-delay:200ms}
.cad .etapa-corpo > :nth-child(4){animation-delay:255ms}
.cad .etapa-corpo > :nth-child(5){animation-delay:310ms}
.cad .etapa-corpo > :nth-child(6){animation-delay:365ms}
.cad .etapa-corpo > :nth-child(7){animation-delay:420ms}
.cad .etapa-corpo > :nth-child(8){animation-delay:475ms}
.cad .etapa-corpo > :nth-child(9){animation-delay:530ms}
.cad .etapa-corpo > :nth-child(10){animation-delay:585ms}
.cad .etapa-corpo > :nth-child(11){animation-delay:640ms}
.cad .etapa-corpo > :nth-child(12){animation-delay:695ms}
.cad .etapa-corpo > :nth-child(13){animation-delay:750ms}
.cad .etapa-corpo > :nth-child(14){animation-delay:805ms}
.cad .etapa-corpo > :nth-child(15){animation-delay:860ms}
.cad .etapa .cta{margin-top:30px}

/* boas-vindas: uma carta do estúdio (brandbook 18). Uma coluna no celular,
   foto ao lado da carta a partir de 960px, só nesta etapa. */
.cad .boas-vindas{display:grid;gap:30px}
.cad .foto-abertura{position:relative;border-radius:22px;overflow:hidden;aspect-ratio:4/3;background:var(--soft)}
/* rotação das fotos: a atual aparece por cima num esmaecer e afasta devagar
   enquanto está na tela; a que sai some por baixo */
.cad .foto-abertura{animation:cad-sobe .9s cubic-bezier(.22,1,.36,1) both}
.cad .slide{position:absolute;inset:0;opacity:0;transition:opacity 1.4s ease}
.cad .slide.ativa{opacity:1}
.cad .slide img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.08);transition:transform 7s linear}
.cad .slide.ativa img{transform:scale(1)}
.cad .pontos{position:absolute;right:20px;bottom:24px;z-index:2;display:flex;gap:6px;align-items:center}
.cad .pontos span{width:6px;height:6px;border-radius:999px;background:rgba(255,255,255,.5);transition:width .4s ease,background .4s ease}
.cad .pontos span.ativo{width:18px;background:#fff}
.cad .foto-abertura::after{content:"";position:absolute;inset:auto 0 0 0;height:45%;z-index:1;background:linear-gradient(to top,rgba(29,29,27,.55),rgba(29,29,27,0))}
.cad .foto-abertura .marca{position:absolute;left:20px;bottom:18px;z-index:2;height:30px;width:auto;opacity:.95}
.cad .carta h1{font-size:34px;line-height:1.18;margin:0;text-wrap:balance}
.cad .carta .texto{font-size:16px;line-height:1.7;color:var(--ink);margin-top:16px}
.cad .carta .texto + .texto{margin-top:12px}
.cad .caminho-rotulo{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-soft);margin-top:34px}
/* caminho até a data: timeline na linguagem da "Timeline do contrato"
   (brandbook 8 e 18). A linha conectora é desenho, não borda: um ::before
   de 2px no petróleo claro, do círculo de um passo ao do próximo. */
.cad .passos{list-style:none;margin:18px 0 0}
.cad .passos li{position:relative;display:flex;gap:16px;align-items:flex-start;padding-bottom:22px}
.cad .passos li:last-child{padding-bottom:0}
.cad .passos li:not(:last-child)::before{content:"";position:absolute;left:19px;top:46px;bottom:6px;width:2px;border-radius:2px;
  background:#D3E2E7;transform-origin:top;animation:cad-linha .5s cubic-bezier(.22,1,.36,1) both}
@keyframes cad-linha{from{transform:scaleY(0)}to{transform:none}}
.cad .passos .icone{flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#EAF1F3;color:var(--accent);
  display:flex;align-items:center;justify-content:center;animation:cad-pop .45s cubic-bezier(.34,1.4,.5,1) both}
@keyframes cad-pop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
.cad .passos .texto-passo{padding-top:1px;min-width:0}
.cad .passos .rotulo-passo{display:block;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft);line-height:1.4}
.cad .passos strong{display:block;font-weight:500;font-size:15.5px;color:var(--ink);line-height:1.35;margin-top:1px}
.cad .passos small{display:block;font-size:13.5px;color:var(--ink-soft);line-height:1.5;margin-top:2px}
/* a chegada: círculo cheio e título serifado, é pra lá que o casal vai */
.cad .passos li.chegada .icone{background:var(--accent);color:#fff}
.cad .passos li.chegada strong{font-family:var(--serif);font-size:21px;color:var(--accent);margin-top:0;line-height:1.25}
.cad .passos li:nth-child(1) .icone{animation-delay:420ms}
.cad .passos li:nth-child(1)::before{animation-delay:500ms}
.cad .passos li:nth-child(2) .icone{animation-delay:560ms}
.cad .passos li:nth-child(2)::before{animation-delay:640ms}
.cad .passos li:nth-child(3) .icone{animation-delay:700ms}
.cad .passos li:nth-child(3)::before{animation-delay:780ms}
.cad .passos li:nth-child(4) .icone{animation-delay:840ms}
.cad .passos li:nth-child(4)::before{animation-delay:920ms}
.cad .passos li:nth-child(5) .icone{animation-delay:980ms}
.cad .passos li:nth-child(5)::before{animation-delay:1060ms}
.cad .passos li:nth-child(6) .icone{animation-delay:1120ms}
.cad .passos li:nth-child(6)::before{animation-delay:1200ms}
.cad .carta .cta{margin-top:34px}
/* ---------- botão fixo embaixo, em qualquer largura ----------
   Fora das etapas de propósito: elas entram com transform, e um fixed dentro
   de pai com transform passa a se posicionar pelo pai (pularia junto na
   animação). Por isso o botão de dentro da etapa some e quem aparece é esta
   barra. Única exceção: a abertura a partir de 768px, onde o botão mora na
   coluna da carta (ao lado da foto no computador); ali a barra some. */
.cad .etapa .cta{display:none}
.cad .barra-cta{position:fixed;left:0;right:0;bottom:0;z-index:50;padding:28px 22px calc(16px + var(--sab));
  background:linear-gradient(to top,var(--paper) 62%,rgba(255,255,255,0));pointer-events:none}
.cad .barra-cta > *{pointer-events:auto;max-width:476px;margin-left:auto;margin-right:auto}
.cad .barra-cta .cta{margin-top:0}
.cad .barra-cta .erro{min-height:0;margin:0 0 10px}
/* o erro do envio aparece na barra, perto do botão; o de dentro da etapa
   fica só pro leitor de tela (é ele que tem o role="alert") */
.cad .etapa .erro{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;margin:0}
@media (min-width:768px){
  .cad .carta .cta{display:block}
  .cad .barra-cta.na-abertura{display:none}
}

/* seta e brilho do botão (brandbook 18): o brilho vai em todo botão do
   fluxo, até o "Confirmar nossa data"; a seta (com vaivém) só nos de
   avançar, porque o de confirmar é o fim */
.cad .cta .seta{display:inline-block;vertical-align:-3px;margin-left:10px}
.cad .cta.brilho{position:relative;overflow:hidden;isolation:isolate}
.cad .cta.brilho::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;pointer-events:none;
  background:linear-gradient(105deg,rgba(255,255,255,0),rgba(255,255,255,.28),rgba(255,255,255,0));
  transform:skewX(-20deg);animation:cad-brilho 3.2s ease-in-out 1.2s infinite}
@keyframes cad-brilho{0%{left:-60%}45%,100%{left:130%}}
.cad .cta.brilho .seta{animation:cad-vaivem 1.6s ease-in-out infinite}
@keyframes cad-vaivem{0%,100%{transform:none}50%{transform:translateX(4px)}}

/* recado prático da abertura: card petróleo claro com lâmpada, sem borda */
.cad .dica-card{display:flex;gap:12px;align-items:center;background:#EAF1F3;border-radius:16px;padding:14px 16px;margin-top:18px}
.cad .dica-icone{flex-shrink:0;width:36px;height:36px;border-radius:12px;background:var(--paper);color:var(--accent);display:flex;align-items:center;justify-content:center}
.cad .dica-card p{font-size:14px;line-height:1.5;color:var(--accent);font-weight:400}
/* a explicação de cada etapa usa o mesmo card, com o ícone no topo porque o
   texto costuma quebrar em várias linhas */
.cad .dica-card.explica{align-items:flex-start;margin:16px 0 26px}
@media (min-width:960px){
  .cad .pagina.larga{max-width:1040px}
  .cad .boas-vindas{grid-template-columns:1fr 1fr;gap:64px;align-items:center}
  .cad .foto-abertura{aspect-ratio:4/5}
  .cad .carta h1{font-size:40px}
}

/* revisão: um bloco por etapa, no fundo soft, com o Editar no canto */
/* cartão-convite: o resumo do grande dia no topo da revisão (brandbook 18) */
.cad .convite{text-align:center;color:#fff;border-radius:22px;padding:30px 24px 26px;margin-bottom:14px;
  background:radial-gradient(120% 90% at 50% 0%,#0B4C5F 0%,var(--accent) 62%)}
.cad .convite-rotulo{display:block;font-size:11px;letter-spacing:.22em;text-transform:uppercase;opacity:.72}
.cad .convite-nomes{font-family:var(--serif);font-size:32px;line-height:1.15;margin-top:10px;text-wrap:balance}
.cad .convite-coracao{display:block;margin:14px auto 12px;opacity:.85}
.cad .convite-data{font-size:16px;font-weight:400;line-height:1.45}
.cad .convite-onde{font-size:14px;line-height:1.5;opacity:.8;margin-top:2px}
.cad .convite-contagem{display:inline-block;margin-top:16px;font-size:12px;letter-spacing:.06em;font-weight:400;
  padding:6px 14px;border-radius:999px;background:rgba(255,255,255,.14)}

/* um bloco por etapa: ícone da etapa, título e Editar em cima, valores embaixo */
.cad .revisao{display:grid;gap:12px}
.cad .revisao > *{animation:cad-sobe .55s cubic-bezier(.22,1,.36,1) both}
.cad .revisao > :nth-child(1){animation-delay:200ms}
.cad .revisao > :nth-child(2){animation-delay:290ms}
.cad .revisao > :nth-child(3){animation-delay:380ms}
.cad .revisao > :nth-child(4){animation-delay:470ms}
.cad .revisao > :nth-child(5){animation-delay:560ms}
.cad .revisao > :nth-child(6){animation-delay:650ms}
.cad .revisao-bloco{background:var(--soft);border-radius:18px;padding:16px 16px 18px}
.cad .revisao-topo{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.cad .revisao-icone{width:36px;height:36px;border-radius:50%;background:var(--paper);color:var(--accent);flex-shrink:0;
  display:flex;align-items:center;justify-content:center}
.cad .revisao-titulo{flex:1;min-width:0;font-size:15px;font-weight:500;color:var(--ink);line-height:1.3}
.cad .editar{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;font-size:13px;font-weight:400;color:var(--accent);
  background:var(--paper);padding:7px 12px;border-radius:999px;transition:background .15s ease}
@media (hover:hover){.cad .editar:hover{background:var(--soft-foco)}}
.cad .editar:focus-visible{outline:none;background:var(--soft-foco)}
.cad .revisao dl{display:grid;gap:12px;margin:0}
@media (min-width:480px){.cad .revisao dl{padding-left:48px}}
.cad .revisao dt{font-size:12px;color:var(--ink-soft);line-height:1.4}
.cad .revisao dd{margin:2px 0 0;font-size:15px;color:var(--ink);font-weight:400;line-height:1.45;word-break:break-word;white-space:pre-line}
.cad .revisao .vazio{font-size:14px;color:var(--ink-soft)}

/* recebido: o check se desenha e o texto sobe */
.cad .sucesso{animation:cad-sobe .6s cubic-bezier(.22,1,.36,1) both}
.cad .check{width:64px;height:64px;margin:0 auto 18px;display:block}
.cad .check circle{fill:var(--soft)}
.cad .check path{fill:none;stroke:var(--accent);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:30;stroke-dashoffset:30;animation:cad-traco .6s .25s cubic-bezier(.65,0,.35,1) forwards}
@keyframes cad-traco{to{stroke-dashoffset:0}}

/* quem pediu menos movimento no sistema recebe a troca seca */
@media (prefers-reduced-motion:reduce){
  .cad .etapa,.cad .etapa-corpo > *,.cad .sucesso,.cad .foto-abertura{animation:none}
  .cad .slide,.cad .slide img{transition:none}
  .cad .passos .icone,.cad .passos li::before{animation:none}
  .cad .cta.brilho::after{display:none}
  .cad .revisao > *{animation:none}
  .cad .cta.brilho .seta{animation:none}
  .cad .check path{animation:none;stroke-dashoffset:0}
  .cad .progresso span{transition:none}
}

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

/* ---------- fotos da abertura ----------
   Portfólio do Jordan, fixo como o resto da marca dele (dívida "Nome e
   marca" no CLAUDE.md). `foco` é o object-position de cada uma: as fotos são
   retrato 2:3 e o quadro do celular é 4:3, então sem isso metade dos casais
   sairia sem cabeça.
   Os arquivos são webp prontos em public/img/abertura/ (750 e 1200px),
   gerados por tools/fotos-abertura/gerar.mjs. Não passam pelo next/image: no
   iPhone do Jordan o otimizador do dev não entregava as fotos, e arquivo
   estático chega igual em qualquer aparelho. */
const FOTOS_ABERTURA = [
  { nome: "prewedding", foco: "50% 62%", alt: "Casal no alto de uma caminhonete antiga, no campo, ao pôr do sol" },
  { nome: "casal-jardim", foco: "50% 40%", alt: "Noivos caminhando de mãos dadas em um jardim" },
  { nome: "entrega-1", foco: "50% 45%", alt: "Noivo beijando o rosto da noiva, em preto e branco" },
  { nome: "casal-palacio", foco: "50% 35%", alt: "Noivos em um palácio, em preto e branco" },
  { nome: "casal-campo", foco: "50% 65%", alt: "Noivos caminhando ao lado de um milharal, em preto e branco" },
  { nome: "noiva-retrato", foco: "50% 30%", alt: "Retrato da noiva com véu, sentada, em preto e branco" },
  { nome: "entrega-3", foco: "50% 35%", alt: "Retrato próximo dos noivos" },
  { nome: "entrega-2", foco: "50% 70%", alt: "Noiva em um salão histórico, em preto e branco" },
];
const TEMPO_FOTO = 5500;

/* Só a atual e a próxima são baixadas: as oito juntas passariam de 10MB no
   4G do casal. Cada troca libera mais uma. Parada quando a etapa não está na
   tela e pra quem pede menos movimento (aí fica a primeira). */
function FotosAbertura({ rodando }: { rodando: boolean }) {
  const [atual, setAtual] = useState(0);
  const [baixadas, setBaixadas] = useState(2);

  useEffect(() => {
    if (!rodando || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setAtual((a) => (a + 1) % FOTOS_ABERTURA.length);
      setBaixadas((b) => Math.min(FOTOS_ABERTURA.length, b + 1));
    }, TEMPO_FOTO);
    return () => clearInterval(t);
  }, [rodando]);

  return (
    <div className="foto-abertura">
      {FOTOS_ABERTURA.slice(0, baixadas).map((f, i) => (
        <div key={f.nome} className={"slide" + (i === atual ? " ativa" : "")} aria-hidden={i !== atual}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={"/img/abertura/" + f.nome + "-750.webp"}
            srcSet={"/img/abertura/" + f.nome + "-750.webp 750w, /img/abertura/" + f.nome + "-1200.webp 1200w"}
            sizes="(min-width: 960px) 476px, calc(100vw - 44px)"
            alt={f.alt} fetchPriority={i === 0 ? "high" : "auto"} decoding="async"
            style={{ objectPosition: f.foco }} />
        </div>
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="marca" src="/img/logo-principal-offwhite.png" alt="Jordan Santos" />
      <div className="pontos" aria-hidden>
        {FOTOS_ABERTURA.map((f, i) => <span key={f.nome} className={i === atual ? "ativo" : ""} />)}
      </div>
    </div>
  );
}

/* ---------- cartão-convite da revisão ----------
   O resumo do grande dia, no tom de um convite (brandbook 18). Recebe tudo
   pronto, sem estado: a revisão monta quando entra e lê os valores dali. */
function dataPorExtenso(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [a, m, d] = iso.split("-").map(Number);
  const texto = new Date(a, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function contagem(data: string, hoje: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{4}-\d{2}-\d{2}$/.test(hoje)) return "";
  const dias = Math.round((Date.UTC(...(data.split("-").map(Number) as [number, number, number])) -
    Date.UTC(...(hoje.split("-").map(Number) as [number, number, number]))) / 86400000);
  if (dias < 0) return "";
  if (dias === 0) return "É hoje!";
  if (dias === 1) return "É amanhã!";
  return "Faltam " + dias.toLocaleString("pt-BR") + " dias";
}

function CartaoConvite({ nomes, data, horario, local, hoje }: {
  nomes: string; data: string; horario: string; local: string; hoje: string;
}) {
  const quando = dataPorExtenso(data);
  const onde = [horario ? "às " + horario : "", local].filter(Boolean).join(" · ");
  const falta = contagem(data, hoje);
  return (
    <div className="convite">
      <span className="convite-rotulo">O grande dia de</span>
      <p className="convite-nomes">{nomes}</p>
      <Heart className="convite-coracao" size={16} strokeWidth={1.8} fill="currentColor" aria-hidden />
      {quando ? <p className="convite-data">{quando}</p> : null}
      {onde ? <p className="convite-onde">{onde}</p> : null}
      {falta ? <span className="convite-contagem">{falta}</span> : null}
    </div>
  );
}

/* ---------- etapas ---------- */

type Etapa = "inicio" | SecaoFormulario | "revisar";

/* O que cada etapa explica e o resumo dela na tela de boas-vindas. Texto do
   casal: voz do estúdio, primeira pessoa do plural (TOM-DE-VOZ.md). */
const SOBRE_ETAPA: Record<SecaoFormulario, { explica: string; resumo: string }> = {
  assinar: {
    explica: "Dados de quem vai assinar o contrato. Se só uma pessoa for assinar, basta preencher os dados dela.",
    resumo: "Quem assina o contrato e como falamos com vocês",
  },
  endereco: {
    explica: "O contrato pede um endereço pra ficar completo. Digitem o CEP que a gente preenche o resto.",
    resumo: "Só o que o documento pede",
  },
  evento: {
    explica: "Com a data, o horário e o local a gente reserva a agenda e começa a planejar a cobertura.",
    resumo: "Data, horário e local do casamento",
  },
  extra: {
    explica: "Algumas perguntas pra gente conhecer vocês um pouco melhor antes do grande dia.",
    resumo: "Algumas perguntas pra conhecer vocês melhor",
  },
};

/* ícone de cada etapa no caminho da abertura (brandbook 18) */
const ICONE_ETAPA: Record<SecaoFormulario, typeof Heart> = {
  assinar: UsersRound,
  endereco: MapPin,
  evento: CalendarHeart,
  extra: MessageCircleHeart,
};

const CAMPOS_DA_SECAO: Record<SecaoFormulario, CampoId[]> = {
  assinar: ["noivo", "noiva", "cpfNoivo", "cpfNoiva", "contato", "email"],
  endereco: ["cep", "numero", "endereco", "complemento", "bairro", "cidade", "estado"],
  evento: ["data", "horario", "local", "enderecoEvento"],
  extra: [],
};

/* tempo de a etapa nova entrar antes de pôr o foco nela */
const ESPERA_FOCO = 360;

/* ============================================================ */

export function FormularioCadastro({ formulario }: { formulario: Formulario }) {
  const [valores, setValores] = useState<Valores>(VAZIO);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<Erro>(null);
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [cepStatus, setCepStatus] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [direcao, setDirecao] = useState<"frente" | "tras">("frente");
  /* o WhatsApp mora no plugin (fora do estado), então a revisão mostra uma
     cópia tirada na hora de entrar nela: ler o plugin durante o render não
     acompanharia as mudanças */
  const [contatoRevisao, setContatoRevisao] = useState("");
  /* "hoje" da contagem do cartão-convite, tirado ao entrar na revisão (ler o
     relógio durante o render não é puro) */
  const [hojeRevisao, setHojeRevisao] = useState("");
  /* veio do "Editar" da revisão: o botão da etapa leva de volta pra revisão
     em vez de andar por todas as etapas seguintes de novo */
  const [daRevisao, setDaRevisao] = useState(false);

  const camposRef = useRef<Partial<Record<string, ElementoCampo | null>>>({});
  const etapasRef = useRef<Partial<Record<Etapa, HTMLElement | null>>>({});
  const topoRef = useRef<HTMLDivElement | null>(null);
  const itiRef = useRef<Iti | null>(null);
  const ultimoCepRef = useRef("");

  const registrar = useCallback((id: string) => (el: ElementoCampo | null) => {
    camposRef.current[id] = el;
  }, []);
  const registrarEtapa = useCallback((qual: Etapa) => (el: HTMLElement | null) => {
    etapasRef.current[qual] = el;
  }, []);

  const cfg = formulario.campos;
  const aparece = (id: CampoId) => cfg[id].visivel;
  /* "(opcional)" em todo campo que não é exigido, CPF incluído. Os nomes
     ficam sem: um dos dois é obrigatório (regra do par, explicada no card
     da etapa), e marcar os dois como opcionais diria o contrário. */
  const opcional = (id: CampoId) => cfg[id].visivel && !cfg[id].obrigatorio && id !== "noivo" && id !== "noiva";
  const perguntas = perguntasVisiveis(formulario);
  const perguntasDa = (secao: SecaoFormulario) => perguntas.filter((p) => p.secao === secao);

  /* etapas que existem pra ESTA config, na ordem */
  const secoes = SECOES.map((x) => x.id).filter((id) =>
    id === "extra" ? perguntasDa("extra").length > 0
    : id === "endereco" ? CAMPOS_DA_SECAO.endereco.some(aparece) || perguntasDa("endereco").length > 0
    : true);
  const etapas: Etapa[] = ["inicio", ...secoes, "revisar"];
  const indice = etapas.indexOf(etapa);
  /* a contagem que o casal vê não inclui as boas-vindas */
  const totalPassos = etapas.length - 1;

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
        /* sempre o dropdown de altura fixa com rolagem por dentro. No
           padrão ("AUTO") o plugin troca pra uma lista em tela cheia no
           celular e em telas de até 500px. */
        countrySelectorMode: "DROPDOWN",
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

  /* WhatsApp como a pessoa vê no campo (o plugin formata enquanto digita),
     com o DDI na frente. É pra revisão: o envio usa o valorContato(). */
  function contatoLegivel(): string {
    const nac = (camposRef.current.contato?.value ?? "").trim();
    if (!nac) return "";
    const pais = itiRef.current?.getSelectedCountry();
    return pais && pais.dialCode ? "+" + pais.dialCode + " " + nac : nac;
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

  /* ---------- navegação entre etapas ---------- */

  /* Topo fixo com o teclado aberto no iPhone. O Safari do iOS não encolhe a
     página quando o teclado sobe: ele DESLOCA a área visível pra cima, e o
     que é fixed fica preso à página inteira, então o topo saía da tela. A
     visualViewport diz quanto a área visível desceu (offsetTop), e o topo
     desce junto. No computador e no Android o offsetTop fica 0 e nada muda. */
  useEffect(() => {
    const vv = window.visualViewport;
    const topo = topoRef.current;
    if (!vv || !topo || etapa === "inicio" || enviado) return;
    function acompanhar() {
      if (!vv || !topo) return;
      const desce = Math.max(0, Math.round(vv.offsetTop));
      topo.style.transform = desce ? "translateY(" + desce + "px)" : "";
    }
    acompanhar();
    vv.addEventListener("resize", acompanhar);
    vv.addEventListener("scroll", acompanhar);
    return () => {
      vv.removeEventListener("resize", acompanhar);
      vv.removeEventListener("scroll", acompanhar);
      topo.style.transform = "";
    };
  }, [etapa, enviado]);

  /* Entrou numa etapa: volta pro topo (a etapa nova começa lá) e, onde há
     mouse, põe o foco no primeiro campo. No toque, não: abrir o teclado
     sozinho cobre a explicação que a pessoa ainda nem leu. */
  useEffect(() => {
    window.scrollTo(0, 0);
    if (etapa === "inicio" || etapa === "revisar") return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    const t = setTimeout(() => {
      etapasRef.current[etapa]?.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
    }, ESPERA_FOCO);
    return () => clearTimeout(t);
  }, [etapa]);

  function irPara(destino: Etapa) {
    if (destino === "revisar") {
      setContatoRevisao(contatoLegivel());
      const d = new Date();
      setHojeRevisao(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"));
    }
    setDirecao(etapas.indexOf(destino) < indice ? "tras" : "frente");
    setErroGeral("");
    setEtapa(destino);
  }

  function voltar() {
    if (indice <= 0) return;
    setDaRevisao(false);
    irPara(etapas[indice - 1]);
  }

  function editar(secao: SecaoFormulario) {
    setDaRevisao(true);
    irPara(secao);
  }

  /* ---------- validação ---------- */

  /* Marca o campo e leva o casal até ele. O erro pode estar numa etapa que
     não é a atual (a revisão confere tudo de novo antes de enviar), e aí a
     etapa troca primeiro e o foco espera ela entrar. */
  function marcarErro(campo: string, msg: string) {
    setErro({ campo, msg });
    const secao = campo in DEFINICAO
      ? DEFINICAO[campo as CampoId].secao
      : perguntas.find((p) => p.id === campo)?.secao;
    const trocou = !!secao && secao !== etapa;
    if (trocou) irPara(secao);
    setTimeout(() => {
      const el = camposRef.current[campo];
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => el.focus({ preventScroll: true }), 280);
    }, trocou ? ESPERA_FOCO : 0);
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

  /** Confere UMA etapa. A revisão chama pra todas, na ordem. */
  function validarSecao(secao: SecaoFormulario): boolean {
    setErro(null);
    if (secao === "assinar" && !validarContratantes()) return false;
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
      { campo: "enderecoEvento", valor: v("enderecoEvento"), ok: true, vazio: "Preencha o endereço do evento." },
    ];
    for (const r of regras) {
      if (DEFINICAO[r.campo].secao !== secao || !aparece(r.campo)) continue;
      if (!r.valor) {
        if (campoExigido(formulario, r.campo)) { marcarErro(r.campo, r.vazio); return false; }
        continue;
      }
      if (!r.ok) { marcarErro(r.campo, r.invalido ?? r.vazio); return false; }
    }
    for (const p of perguntasDa(secao)) {
      const msg = erroDaResposta(p, (respostas[p.id] ?? "").trim());
      if (msg) { marcarErro(p.id, msg); return false; }
    }
    return true;
  }

  /* ---------- avançar / enviar ----------
     Um <form> só pras etapas todas: Enter num campo avança, como o botão. */
  function aoEnviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (etapa === "inicio") { irPara(etapas[1]); return; }
    if (etapa === "revisar") { void enviar(); return; }
    if (!validarSecao(etapa)) return;
    if (daRevisao) { setDaRevisao(false); irPara("revisar"); return; }
    irPara(etapas[indice + 1]);
  }

  async function enviar() {
    setErroGeral("");
    for (const secao of secoes) if (!validarSecao(secao)) return;
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
          enderecoEvento: v("enderecoEvento"),
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

  /* ---------- revisão: o que foi preenchido, por etapa ---------- */
  function linhasDaRevisao(secao: SecaoFormulario): { rotulo: string; valor: string }[] {
    const linhas: { rotulo: string; valor: string }[] = [];
    const v = (id: CampoControlado) => (aparece(id) ? valores[id].trim() : "");
    /* endereço e "quando" se leem como uma frase, não como sete linhas */
    if (secao === "endereco") {
      const rua = [v("endereco"), v("numero")].filter(Boolean).join(", ") + (v("complemento") ? " (" + v("complemento") + ")" : "");
      const cidade = [v("cidade"), v("estado")].filter(Boolean).join("/");
      const tudo = [rua, v("bairro"), cidade, v("cep") ? "CEP " + v("cep") : ""].filter(Boolean).join("\n");
      if (tudo) linhas.push({ rotulo: "Endereço", valor: tudo });
    }
    if (secao === "evento" && (v("data") || v("horario"))) {
      const quando = [v("data") ? exibirResposta({ tipo: "data", valor: v("data") }) : "", v("horario")].filter(Boolean).join(" às ");
      linhas.push({ rotulo: "Quando", valor: quando });
    }
    const juntos: CampoId[] = ["endereco", "numero", "complemento", "bairro", "cidade", "estado", "cep", "data", "horario"];
    for (const id of CAMPOS_DA_SECAO[secao]) {
      if (juntos.includes(id)) continue;
      if (!aparece(id)) continue;
      const valor = id === "contato" ? contatoRevisao : valores[id as CampoControlado].trim();
      if (valor) linhas.push({ rotulo: cfg[id].rotulo, valor });
    }
    for (const p of perguntasDa(secao)) {
      const valor = (respostas[p.id] ?? "").trim();
      if (valor) linhas.push({ rotulo: p.rotulo, valor: exibirResposta({ tipo: p.tipo, valor }) });
    }
    return linhas;
  }

  const textoDoBotao =
    etapa === "inicio" ? "Vamos começar"
    : etapa === "revisar" ? (enviando ? "Confirmando..." : "Confirmar nossa data")
    : daRevisao ? "Salvar e revisar"
    : "Continuar";

  /* seta em todo botão que leva pra frente; o de confirmar não leva, porque
     é o fim e não um próximo passo (brandbook 18) */
  const conteudoDoBotao = etapa === "revisar" ? textoDoBotao : (
    <>{textoDoBotao}<ArrowRight className="seta" size={16} strokeWidth={1.6} aria-hidden /></>
  );

  const atributosEtapa = (qual: Etapa) => ({
    hidden: etapa !== qual,
    "data-dir": direcao,
    ref: registrarEtapa(qual),
  });

  function corpoDaSecao(secao: SecaoFormulario): ReactNode {
    if (secao === "assinar") {
      return (
        <>
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
        </>
      );
    }
    if (secao === "endereco") {
      return (
        <>
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
        </>
      );
    }
    if (secao === "evento") {
      return (
        <>
          <Par
            a={fixo("data", { type: "date", onClick: abrirPicker })}
            b={fixo("horario", { type: "time", onClick: abrirPicker })}
          />
          {fixo("local")}
          {fixo("enderecoEvento", { autoComplete: "off" })}
          {extras("evento")}
        </>
      );
    }
    return <>{extras("extra")}</>;
  }

  return (
    <main className={`cad ${fonteSerif.variable} ${fonteSans.variable}`}>
      <style>{CSS}</style>
      <div className={"pagina" + (etapa === "inicio" && !enviado ? " larga" : "") + (enviado ? "" : " com-barra") +
        (etapa !== "inicio" && !enviado ? " com-topo" : "")}>
        {enviado ? (
          <div className="sucesso">
            <svg className="check" viewBox="0 0 64 64" aria-hidden>
              <circle cx="32" cy="32" r="32" />
              <path d="M21 33l7.5 7.5L44 25" />
            </svg>
            <h1>Recebido!</h1>
            <p className="sub">Vamos revisar seus dados e já mandamos o contrato pra você assinar. Será uma honra eternizar esse momento.</p>
            <a className="cta" href="/proposta">Voltar pro início</a>
          </div>
        ) : (
          <form onSubmit={aoEnviar} noValidate>
            {etapa !== "inicio" ? (
              <div className="topo-etapa" ref={topoRef}>
                <button type="button" className="voltar-etapa" onClick={voltar} aria-label="Voltar pra etapa anterior">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                  </svg>
                </button>
                <div className="progresso-info">
                  <div className="progresso-rotulo">
                    {etapa === "revisar" ? "Última etapa" : "Etapa " + indice + " de " + totalPassos}
                  </div>
                  <div className="progresso" role="progressbar" aria-valuemin={0} aria-valuemax={totalPassos} aria-valuenow={indice}
                    aria-label="Progresso do cadastro">
                    <span style={{ width: (indice / totalPassos) * 100 + "%" }} />
                  </div>
                </div>
              </div>
            ) : null}

            {/* ---------- boas-vindas ----------
                Uma carta, não um formulário (a primeira versão, com selo
                "Cadastro" e caixas cinzas, foi achada fria). Fotos e logo
                são do Jordan, fixas como o resto da marca dele
                (dívida "Nome e marca" no CLAUDE.md). */}
            <section className="etapa" {...atributosEtapa("inicio")}>
              <div className="boas-vindas">
                <FotosAbertura rodando={etapa === "inicio" && !enviado} />
                <div className="carta etapa-corpo">
                  <h1>Que alegria ter vocês aqui</h1>
                  <p className="texto">
                    Cada casal que chega até a gente traz uma história, e a de vocês já começou a nos encantar.
                    Antes de guardar essa data na nossa agenda, queremos conhecer vocês um pouquinho melhor.
                  </p>
                  <div className="dica-card">
                    <span className="dica-icone"><Lightbulb size={18} strokeWidth={1.8} aria-hidden /></span>
                    <p>Leva uns 3 minutos. Dá pra voltar quando quiserem e conferir tudo antes de enviar.</p>
                  </div>
                  <div className="caminho-rotulo">O nosso caminho até a data</div>
                  <ol className="passos">
                    {secoes.map((id, i) => {
                      const Icone = ICONE_ETAPA[id];
                      return (
                        <li key={id}>
                          <span className="icone"><Icone size={18} strokeWidth={1.8} aria-hidden /></span>
                          <span className="texto-passo">
                            <span className="rotulo-passo">Etapa {i + 1}</span>
                            <strong>{TITULO_SECAO[id]}</strong>
                            <small>{SOBRE_ETAPA[id].resumo}</small>
                          </span>
                        </li>
                      );
                    })}
                    <li className="chegada">
                      <span className="icone"><Heart size={18} strokeWidth={1.8} fill="currentColor" aria-hidden /></span>
                      <span className="texto-passo">
                        <strong>A data é de vocês</strong>
                        <small>Conferimos tudo e mandamos o contrato pra vocês</small>
                      </span>
                    </li>
                  </ol>
                  <button className="cta brilho" type="submit">{conteudoDoBotao}</button>
                </div>
              </div>
            </section>

            {/* ---------- uma etapa por seção ---------- */}
            {secoes.map((secao) => (
              <section key={secao} className="etapa" {...atributosEtapa(secao)}>
                <div className="etapa-corpo">
                  <h1>{TITULO_SECAO[secao]}</h1>
                  <div className="dica-card explica">
                    <span className="dica-icone"><Info size={18} strokeWidth={1.8} aria-hidden /></span>
                    <p>{SOBRE_ETAPA[secao].explica}</p>
                  </div>
                  {corpoDaSecao(secao)}
                  <button className="cta brilho" type="submit">{conteudoDoBotao}</button>
                </div>
              </section>
            ))}

            {/* ---------- revisão ---------- */}
            <section className="etapa" {...atributosEtapa("revisar")}>
              <div className="etapa-corpo">
                <h1>Confere se está tudo certo</h1>
                <p className="sub">Se algo estiver errado, é só editar. Depois é confirmar que a gente cuida do resto.</p>
                {etapa === "revisar" ? (
                  <div className="revisao">
                    <CartaoConvite
                      nomes={[valores.noivo.trim(), valores.noiva.trim()].filter(Boolean).join(" & ")}
                      data={valores.data}
                      horario={aparece("horario") ? valores.horario : ""}
                      local={aparece("local") ? valores.local.trim() : ""}
                      hoje={hojeRevisao}
                    />
                    {secoes.map((secao) => {
                      const linhas = linhasDaRevisao(secao);
                      const Icone = ICONE_ETAPA[secao];
                      return (
                        <div key={secao} className="revisao-bloco">
                          <div className="revisao-topo">
                            <span className="revisao-icone"><Icone size={17} strokeWidth={1.8} aria-hidden /></span>
                            <span className="revisao-titulo">{TITULO_SECAO[secao]}</span>
                            <button type="button" className="editar" onClick={() => editar(secao)}
                              aria-label={"Editar " + TITULO_SECAO[secao]}>
                              <Pencil size={13} strokeWidth={1.8} aria-hidden /> Editar
                            </button>
                          </div>
                          <dl>
                            {linhas.length ? linhas.map((l) => (
                              <div key={l.rotulo}><dt>{l.rotulo}</dt><dd>{l.valor}</dd></div>
                            )) : <dd className="vazio">Nada preenchido</dd>}
                          </dl>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <button className="cta brilho" type="submit" disabled={enviando}>{textoDoBotao}</button>
                <p className="erro" role="alert">{erroGeral}</p>
              </div>
            </section>

            {/* botão fixo embaixo (ver .barra-cta no CSS); o erro do envio
                aparece aqui, perto do botão, que é onde o olho está */}
            <div className={"barra-cta" + (etapa === "inicio" ? " na-abertura" : "")}>
              {etapa === "revisar" && erroGeral ? <p className="erro" aria-hidden>{erroGeral}</p> : null}
              <button className="cta brilho" type="submit"
                disabled={etapa === "revisar" && enviando}>{conteudoDoBotao}</button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
