/*
  Animação de entrada ao rolar da proposta: cada `.reveal` ganha `.in` quando
  entra na tela (IntersectionObserver, 12% visível), uma vez só. Com
  prefers-reduced-motion, ou sem IntersectionObserver, tudo aparece de uma
  vez. Componente sem UI: a página em si continua Server Component.
*/
"use client";

import { useEffect } from "react";

export function RevealAoRolar() {
  useEffect(() => {
    const alvos = Array.from(document.querySelectorAll<HTMLElement>(".prop .reveal"));
    const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzMovimento || !("IntersectionObserver" in window)) {
      alvos.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    alvos.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
