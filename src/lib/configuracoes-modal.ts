/*
  Qual seção do modal de Configurações está aberta (null = fechado).
  Estado de módulo com useSyncExternalStore, e não contexto: quem abre pode
  ser qualquer tela (menu da conta, o link da previsão do tempo, a rota
  /painel/configuracoes), e a rota abre ANTES do AppShell montar o ouvinte
  (efeito de filho roda antes do efeito do pai), então um evento se perderia.
*/
"use client";

import { useSyncExternalStore } from "react";

export type SecaoConfig = "perfil" | "localizacao" | "seguranca";

let atual: SecaoConfig | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export function abrirConfiguracoes(secao: SecaoConfig = "perfil") { atual = secao; avisar(); }
export function fecharConfiguracoes() { atual = null; avisar(); }

export function useSecaoConfig(): SecaoConfig | null {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => atual,
    () => null,
  );
}
