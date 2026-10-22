/*
  Configurações virou modal em 22/10/2026 (ver components/ModalConfiguracoes).
  Esta rota fica pra link salvo e pra quem chega por endereço: abre o modal
  na seção pedida (?secao=localizacao) por cima da Home.
*/
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { abrirConfiguracoes, type SecaoConfig } from "@/lib/configuracoes-modal";

const SECOES: SecaoConfig[] = ["perfil", "localizacao", "seguranca"];

export default function Configuracoes() {
  const router = useRouter();
  const pedida = useSearchParams().get("secao") as SecaoConfig | null;

  useEffect(() => {
    abrirConfiguracoes(pedida && SECOES.includes(pedida) ? pedida : "perfil");
    router.replace("/painel");
  }, [pedida, router]);

  return null;
}
