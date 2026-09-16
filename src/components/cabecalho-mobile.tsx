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

import { useEffect, useSyncExternalStore } from "react";

export type CabecalhoMobile = { titulo: string; voltar: string | null };

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
const TELAS: { rota: RegExp; titulo: string; voltar: string | null }[] = [
  { rota: /^\/painel\/clientes\/[^/]+\/?$/, titulo: "Cliente", voltar: "/painel" },
  { rota: /^\/painel\/clientes\/?$/, titulo: "Clientes", voltar: null },
  { rota: /^\/painel\/configuracoes\/contrato\/?$/, titulo: "Contrato e assinatura", voltar: "/painel/configuracoes" },
  { rota: /^\/painel\/configuracoes\/?$/, titulo: "Configurações", voltar: "/painel" },
  { rota: /^\/painel\/pendencias\/?$/, titulo: "Precisa de atenção", voltar: "/painel" },
  { rota: /^\/painel\/tempo\/?$/, titulo: "Previsão do tempo", voltar: "/painel" },
];

/* ---------- loja do título que só a página sabe ---------- */

let tituloDaPagina: string | null = null;
const ouvintes = new Set<() => void>();

function assinar(cb: () => void) {
  ouvintes.add(cb);
  return () => { ouvintes.delete(cb); };
}
function ler() { return tituloDaPagina; }

function definir(titulo: string | null) {
  if (titulo === tituloDaPagina) return;
  tituloDaPagina = titulo;
  ouvintes.forEach((cb) => cb());
}

/**
 * Põe no cabeçalho do celular um título que só a página conhece (o nome do
 * casal, por exemplo). Não desenha nada: enquanto não houver texto, vale o do
 * mapa. Ao sair da tela o título é devolvido, senão ele vazaria pra próxima.
 */
export function TituloMobile({ titulo }: { titulo?: string | null }) {
  useEffect(() => {
    definir(titulo?.trim() || null);
    return () => definir(null);
  }, [titulo]);
  return null;
}

/** O que o cabeçalho do celular deve mostrar nesta rota, ou null pra manter a logo. */
export function useCabecalhoMobile(caminho: string): CabecalhoMobile | null {
  const daPagina = useSyncExternalStore(assinar, ler, () => null);
  const tela = TELAS.find((t) => t.rota.test(caminho));
  if (!tela) return null;
  return {
    titulo: daPagina || tela.titulo,
    voltar: tela.voltar,
  };
}
