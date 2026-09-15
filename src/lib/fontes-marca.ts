/*
  Tipografia das telas que o CLIENTE do fotógrafo abre (/proposta, /cadastro,
  /assinar). É diferente do painel de propósito: par serifada (display) mais
  sans leve, herdado do site do estúdio. É marca, não se troca por Inter.

  Cada tela aplica `.variable` dos três no elemento raiz e usa as variáveis
  no CSS dela. Os pesos são os mesmos que o site original carregava do Google
  Fonts.
*/
import { Bodoni_Moda, Dancing_Script, Jost } from "next/font/google";

/* Bodoni Moda é fonte variável: sem `weight` (fica "variable", cobrindo os
   400/500/600 que o site usa) porque o next/font só aceita `axes` assim. */
export const fonteSerif = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--fonte-serif",
  display: "swap",
});

export const fonteSans = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--fonte-sans",
  display: "swap",
});

/* a cursiva da assinatura do casal: a mesma fonte alimenta o preview na tela
   e o canvas que vira o PNG enviado ao servidor */
export const fonteCursiva = Dancing_Script({
  subsets: ["latin"],
  weight: "600",
  variable: "--fonte-cursiva",
  display: "swap",
});
