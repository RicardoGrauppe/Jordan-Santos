"use client";
/*
  Título da página no cabeçalho do CELULAR.

  No estúdio original cada página tinha topo próprio, e no celular ele virava
  seta de voltar + nome da página no lugar onde a logo ficava centralizada
  (`.topo-estudio` do configuracoes.html). No port a moldura passou a ser uma
  só pra todas as telas, então quem SABE o título é a página e quem DESENHA é o
  cabeçalho — é isto que liga os dois.

  A seta é só o ícone, sem rótulo: ela sozinha já diz o que faz, e no celular
  cada pixel ao lado do título conta. No computador nada muda — lá o título
  segue dentro da página e o botão de voltar continua escrito por extenso,
  porque sobra espaço e o nome do destino ajuda.

  O título vem de duas fontes, nesta ordem:
  1. o mapa por rota, que faz o PRIMEIRO QUADRO já sair certo;
  2. a loja abaixo, pras telas cujo título só se conhece depois de carregar (o
     nome do casal). Sem o mapa, essas telas piscariam a logo antes do nome.

  Loja externa e não contexto: mandar o título pelo contexto obrigaria a página
  a chamar setState do pai dentro de um efeito, que é o que a regra
  react-hooks/set-state-in-effect proíbe. Mesmo motivo do useSyncExternalStore
  da lateral recolhida, no AppShell.
*/

import { useEffect, useSyncExternalStore, type ComponentType } from "react";

/** Botão de ação no canto direito do cabeçalho, no formato do "marcar todas
 *  como lidas" da tela de Notificações: só ícone, redondo, fundo soft. */
export type AcaoMobile = {
  rotulo: string;
  Icone: ComponentType<{ size?: number }>;
  aoAcionar: () => void;
};

export type CabecalhoMobile = {
  titulo: string;
  voltar: string | null;
  /** selo ao lado do título (ex.: "Beta") */
  selo?: string;
  acao: Omit<AcaoMobile, "aoAcionar"> | null;
};

/* `voltar: null` = destino da barra de baixo, que não tem pra onde voltar.
   A ficha do cliente volta pra Home, e não pra lista, porque é o que o botão
   dela no computador já faz: destino previsível em vez de depender da origem.
   A ordem importa — a primeira rota que casar vence, então as mais específicas
   vêm antes.

   Duas telas ficam de fora de propósito, as duas por terem topo próprio: o
   editor de modelo (/painel/configuracoes/contrato/<id>), cujo título é um
   CAMPO editável com o estado do salvamento embaixo, e a revisão do contrato
   (/painel/clientes/<id>/contrato), que roda SEM moldura nenhuma — lá não
   existe cabeçalho pra receber título. */
const TELAS: { rota: RegExp; titulo: string; voltar: string | null; selo?: string }[] = [
  { rota: /^\/painel\/clientes\/[^/]+\/?$/, titulo: "Cliente", voltar: "/painel/clientes" },
  { rota: /^\/painel\/clientes\/?$/, titulo: "Clientes", voltar: null },
  { rota: /^\/painel\/atelie\/?$/, titulo: "Ateliê", voltar: null },
  { rota: /^\/painel\/configuracoes\/contrato\/?$/, titulo: "Modelos de contrato", voltar: "/painel/configuracoes" },
  { rota: /^\/painel\/configuracoes\/?$/, titulo: "Configurações", voltar: "/painel" },
  { rota: /^\/painel\/produtos\/?$/, titulo: "Produtos e serviços", voltar: "/painel" },
  /* formulário virou modelo do Ateliê (22/10/2026); o título real (nome do
     modelo) vem do TituloMobile da própria tela */
  { rota: /^\/painel\/atelie\/formulario\/[^/]+\/?$/, titulo: "Formulário", voltar: "/painel/atelie" },
  { rota: /^\/painel\/pendencias\/?$/, titulo: "Precisa de atenção", voltar: "/painel" },
  { rota: /^\/painel\/tempo\/?$/, titulo: "Previsão do tempo", voltar: "/painel" },
];

/* ---------- loja do que só a página sabe ---------- */

type DaPagina = { titulo: string | null; acao: Omit<AcaoMobile, "aoAcionar"> | null };

let daPagina: DaPagina = { titulo: null, acao: null };
/* O que o botão FAZ fica fora da loja, numa caixa à parte: ele é uma função
   nova a cada render da página, e guardá-lo na loja faria notificar todo
   mundo toda vez — a moldura re-renderiza, a página re-renderiza, e a gente
   entra em laço. A loja só guarda o que se DESENHA (rótulo e ícone), que é
   estável. */
let executarAcao: (() => void) | null = null;

const ouvintes = new Set<() => void>();

function assinar(cb: () => void) {
  ouvintes.add(cb);
  return () => { ouvintes.delete(cb); };
}
function ler() { return daPagina; }

const VAZIO: DaPagina = { titulo: null, acao: null };

function definir(novo: DaPagina) {
  const igual =
    novo.titulo === daPagina.titulo &&
    novo.acao?.rotulo === daPagina.acao?.rotulo &&
    novo.acao?.Icone === daPagina.acao?.Icone;
  if (igual) return;
  daPagina = novo;
  ouvintes.forEach((cb) => cb());
}

/** Dispara o que a página registrou; a moldura chama sem saber o que é. */
export function acionarAcaoMobile() {
  executarAcao?.();
}

/**
 * Põe no cabeçalho do celular o que só a página conhece: um título (o nome do
 * casal, por exemplo) e/ou um botão de ação no canto direito. Não desenha
 * nada. Enquanto não houver título, vale o do mapa; ao sair da tela, os dois
 * são devolvidos, senão vazariam pra próxima.
 */
export function TituloMobile({ titulo, acao }: { titulo?: string | null; acao?: AcaoMobile }) {
  const aoAcionar = acao?.aoAcionar;
  /* sem lista de dependências de propósito: o callback é trocado a cada
     render e isto NÃO notifica ninguém */
  useEffect(() => {
    executarAcao = aoAcionar ?? null;
  });

  const rotulo = acao?.rotulo;
  const Icone = acao?.Icone;
  useEffect(() => {
    definir({
      titulo: titulo?.trim() || null,
      acao: rotulo && Icone ? { rotulo, Icone } : null,
    });
    return () => definir(VAZIO);
  }, [titulo, rotulo, Icone]);

  return null;
}

/** O que o cabeçalho do celular deve mostrar nesta rota, ou null pra manter a logo. */
export function useCabecalhoMobile(caminho: string): CabecalhoMobile | null {
  const pagina = useSyncExternalStore(assinar, ler, () => VAZIO);
  const tela = TELAS.find((t) => t.rota.test(caminho));
  if (!tela) return null;
  return {
    titulo: pagina.titulo || tela.titulo,
    voltar: tela.voltar,
    selo: tela.selo,
    acao: pagina.acao,
  };
}
