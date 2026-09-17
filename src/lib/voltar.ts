"use client";
/*
  Para onde a SETA de voltar leva. Só a seta: o botão com rótulo (`BotaoVoltar`
  no kit) vai sempre pro lugar que o rótulo nomeia, porque rótulo é promessa.

  Aqui, sem rótulo, a resposta certa é "a página anterior": quem chegou na ficha
  pela lista espera cair na lista, e quem chegou por um card da Home espera cair
  na Home. Destino fixo acerta um dos dois e erra o outro — e, como não há texto
  prometendo lugar nenhum, voltar um passo não contradiz nada.

  Mas `history.back()` sozinho não serve: quem abre um link direto (o caso do
  Jordan no celular, que salva a tela na home do iPhone) tem como página
  anterior o que estava ANTES do app — ou nada. Aí voltar jogaria pra fora.

  Por isso contamos as navegações que aconteceram DENTRO do app nesta aba.
  Houve pelo menos uma? `back()` volta pra uma tela nossa. Não houve? Vale o
  destino mapeado, que é o pai daquela tela.

  O contador é de módulo e não de estado: ele não desenha nada, e um state aqui
  faria a moldura inteira renderizar de novo a cada troca de rota.
*/

import { useRouter } from "next/navigation";
import { useCallback } from "react";

let navegacoesNoApp = 0;

/** Chamado pela moldura a cada troca de rota, menos na primeira pintura. */
export function registrarNavegacao() {
  navegacoesNoApp += 1;
}

/** true quando existe uma tela NOSSA no histórico pra onde voltar. */
export function temParaOndeVoltar() {
  return navegacoesNoApp > 0;
}

/**
 * Devolve a ação de voltar: um passo atrás no histórico quando ele tem uma
 * tela nossa, e o `destino` quando não tem.
 *
 * `antes` roda antes de sair (é o editor de modelo gravando o pendente).
 */
export function useVoltar(destino: string, antes?: () => void | Promise<void>) {
  const router = useRouter();
  return useCallback(async () => {
    if (antes) await antes();
    if (temParaOndeVoltar()) router.back();
    else router.push(destino);
  }, [router, destino, antes]);
}
