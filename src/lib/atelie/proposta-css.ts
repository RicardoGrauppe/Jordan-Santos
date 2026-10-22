/*
  CSS da proposta (o portfólio do Jordan), compartilhado entre o /proposta e
  os blocos do Ateliê: os dois desenham a mesma página, então o estilo mora
  num lugar só. Escopado em `.prop`, que é a raiz das duas.
*/
/*
   Portado do original (ritmo do PDF da proposta) com as regras da casa: o
   selo `.dica` e os cards separam por fundo e sombra, sem borda. O traço do
   `.swoosh` e a linha animada da capa são desenho, não borda. */
export const CSS_PROPOSTA = `
.prop{
  --sat:env(safe-area-inset-top,0px);--sab:env(safe-area-inset-bottom,0px);
  --paper:#FFFFFF;--ink:#1D1D1B;--ink-soft:#706F6F;--accent:#003646;--accent-deep:#4F6278;--noir:#1D1D1B;
  --line:#E8E1DC;--soft:#F6F3F0;--sombra:0 10px 34px rgba(29,29,27,.14);
  --serif:var(--fonte-serif),"Didot",Georgia,serif;
  --sans:var(--fonte-sans),"Helvetica Neue",sans-serif;
  background:var(--paper);color:var(--ink);font-family:var(--sans);
  font-weight:300;font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased;
  touch-action:manipulation;
}
html{scroll-behavior:smooth}
.prop *{margin:0;padding:0;box-sizing:border-box}
.prop img{display:block;max-width:100%}
.prop .pagina{padding:104px 24px}
.prop .miolo{max-width:680px;margin:0 auto;position:relative}
.prop .miolo-largo{max-width:780px;margin:0 auto;position:relative}
.prop .dica{display:inline-block;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);background:var(--soft);border-radius:999px;padding:6px 14px;margin-bottom:28px}
.prop h2{font-family:var(--serif);font-weight:500;font-size:clamp(30px,5.4vw,44px);letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
.prop .centro{text-align:center}

/* capa e fechamento */
.prop .capa{background:var(--noir);min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px;padding:48px 24px}
.prop .capa img{width:min(440px,78vw)}
.prop .capa-hint{color:#8f8f8f;font-size:11px;letter-spacing:.28em;text-transform:uppercase;text-align:center}
.prop .capa-hint::after{content:"";display:block;width:1px;height:44px;margin:16px auto 0;background:linear-gradient(#8f8f8f,transparent);animation:prop-desce 2.4s ease-in-out infinite}
@keyframes prop-desce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(8px);opacity:1}}

/* fotos full-bleed */
.prop .foto-full img{width:100%;height:auto}
.prop .foto-banner{margin:0 -24px 72px}
.prop .foto-banner img{width:100%;height:34vh;object-fit:cover}
/* foco das fotos: ancora o corte do cover nos rostos */
.prop img[src*="casal-jardim"]{object-position:50% 20%}
.prop img[src*="noiva-retrato"]{object-position:48% 30%}
.prop img[src*="casal-campo"]{object-position:45% 45%}
.prop img[src*="prewedding"]{object-position:50% 35%}
.prop img[src*="entrega-1"]{object-position:50% 25%}
.prop img[src*="entrega-2"]{object-position:50% 28%}
.prop img[src*="entrega-3"]{object-position:50% 40%}
.prop img[src*="casal-palacio"]{object-position:55% 28%}

/* pacotes */
.prop .swoosh{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.prop .swoosh path{stroke:var(--line);stroke-width:1.2;fill:none}
.prop .card{position:relative;display:block;width:100%;text-align:inherit;padding:36px 40px;border-radius:16px;background:var(--paper);box-shadow:0 1px 2px rgba(29,29,27,.04),0 8px 24px rgba(29,29,27,.08)}
.prop .card-cabecalho{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}
.prop .card-cabecalho h3{margin-bottom:0}
.prop .pacote-eternal{max-width:460px;text-align:left}
.prop .pacote-heritage{max-width:460px;margin-left:auto;margin-top:56px;text-align:right}
.prop .card h3{font-family:var(--serif);font-weight:500;font-size:30px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:16px}
.prop .card ul{list-style:none;font-size:15px;color:var(--ink)}
.prop .card li{padding:2.5px 0}
.prop .preco{font-family:var(--serif);font-weight:600;font-size:27px;color:var(--accent-deep);margin-top:22px;display:block}
.prop .parcela{font-size:14px;color:var(--ink-soft);letter-spacing:.04em}

/* seções com foto de fundo em tamanho natural: a foto é um <img> no fluxo, a
   altura da seção É a altura da imagem; o conteúdo fica em camada por cima */
.prop #adicionais,.prop #prewedding{position:relative;padding:0}
.prop .secao-bg{display:block;width:100%;height:auto}
.prop .secao-conteudo{position:absolute;top:0;left:0;right:0;padding:104px 24px}

/* adicionais: linhas de texto, nome à esquerda e valor à direita */
.prop .linha{display:flex;align-items:center;gap:16px;width:100%;text-align:left;padding:11px 14px;border-radius:10px;background:rgba(255,255,255,.32)}
.prop .linha .nome{flex:1}
.prop .linha .nome small{display:block;margin-top:4px;font-size:12.5px;line-height:1.5;color:var(--ink-soft);font-weight:300}
.prop .linha .valor{font-family:var(--serif);font-weight:600;font-size:19px;color:var(--accent-deep);white-space:nowrap}

@media (max-width:900px){
  /* em tela estreita o céu não comporta a lista: o conteúdo flui num bloco
     da cor do céu e a foto sobe por trás do fim da lista, com fade no topo */
  .prop #adicionais{background:#FEFEFE;overflow:hidden}
  .prop #adicionais .secao-conteudo{position:relative;z-index:1;padding:44px 16px 0}
  .prop #adicionais .secao-bg{position:relative;z-index:0;margin-top:-40vw;-webkit-mask-image:linear-gradient(to bottom,transparent,#000 20vw);mask-image:linear-gradient(to bottom,transparent,#000 20vw)}
  .prop #adicionais .dica{margin-bottom:14px;padding:5px 12px}
  .prop #adicionais h2{font-size:24px;margin-bottom:4px}
  .prop #adicionais .linha{padding:9px 10px;gap:10px}
  .prop #adicionais .linha .nome{font-size:13.5px;line-height:1.4}
  .prop #adicionais .linha .valor{font-size:15px}
  .prop #prewedding{background:#D7E0E1;overflow:hidden}
  .prop #prewedding .secao-conteudo{position:relative;z-index:1;padding:44px 16px 0}
  .prop #prewedding .secao-bg{position:relative;z-index:0;margin-top:-32vw;-webkit-mask-image:linear-gradient(to bottom,transparent,#000 20vw);mask-image:linear-gradient(to bottom,transparent,#000 20vw)}
  .prop #prewedding .dica{margin-bottom:14px;padding:5px 12px}
  .prop #prewedding h2{font-size:24px;margin-bottom:4px}
  .prop #prewedding .linha{padding:9px 10px;gap:10px}
  .prop #prewedding .linha .nome{font-size:13.5px;line-height:1.4}
  .prop #prewedding .linha .nome small{font-size:12px}
  .prop #prewedding .linha .valor{font-size:15px}
  .prop .prewed-legenda{z-index:1}
}

/* álbum / pré-wedding */
.prop .card-centro{max-width:480px;margin:0 auto;text-align:center}
.prop .card-centro .card-cabecalho{justify-content:flex-end;margin-bottom:14px}
.prop .card-centro + .card-centro{margin-top:26px}
.prop .card-desc{font-size:16px}
.prop .prewed-legenda{position:absolute;left:0;right:0;bottom:0;padding:220px 24px 170px;background:linear-gradient(transparent,rgba(0,0,0,.7));color:#fff;text-align:center;font-size:19px;font-weight:500;letter-spacing:.03em;line-height:1.8}
@media (max-width:640px){.prop .prewed-legenda{padding:70px 20px 64px;font-size:14px;line-height:1.7}}

/* entrega */
.prop .entrega-texto p{font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;line-height:2.1;color:var(--ink);margin-bottom:22px}
.prop .entrega-fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:44px}
.prop .entrega-fotos img{width:100%;aspect-ratio:2/3;object-fit:cover;display:block}

/* citação */
.prop .quote-full{position:relative;background:var(--noir)}
.prop .quote-full img{width:100%;height:auto;opacity:.88}
.prop .quote-full blockquote{position:absolute;top:9%;left:6%;max-width:520px;font-family:var(--serif);font-weight:400;font-size:clamp(21px,3.4vw,29px);line-height:1.55;color:#fff;text-shadow:0 1px 18px rgba(0,0,0,.45)}

/* chamada final (WhatsApp) */
.prop .fale-conosco-texto{max-width:440px;margin:16px auto 0;color:var(--ink-soft);font-size:15.5px;line-height:1.7}
.prop .cta{display:inline-flex;align-items:center;gap:10px;margin-top:32px;padding:19px 40px;font-size:13px;letter-spacing:.22em;text-transform:uppercase;text-decoration:none;border-radius:999px;transition:opacity .2s ease}
.prop .cta svg{width:19px;height:19px;flex-shrink:0}
@media (hover:hover){.prop .cta:hover{opacity:.85}}
.prop .cta:focus-visible{outline:none;opacity:.85}
.prop .cta-whats{background:#25D366;color:#fff}

/* rodapé */
.prop .fim{background:var(--noir);color:#D8D4CE;text-align:center;padding:110px 24px calc(70px + var(--sab))}
.prop .fim img{width:270px;margin:0 auto 44px}
.prop .fim p{font-size:15px;max-width:440px;margin:0 auto 40px;line-height:2}
.prop .fim a{color:#fff;text-decoration:none;display:block;padding:4px 0;letter-spacing:.06em}
@media (hover:hover){.prop .fim a:hover{color:var(--accent-deep)}}
.prop .fim a:focus-visible{background:transparent;color:var(--accent-deep)}
.prop .fim .ano{margin-top:60px;font-size:11px;letter-spacing:.2em;color:#6d6d6d}

/* reveal */
.prop .reveal{opacity:0;transform:translateY(26px);transition:opacity .7s ease,transform .7s ease}
.prop .reveal.in{opacity:1;transform:none}

@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .prop .reveal{opacity:1;transform:none;transition:none}
  .prop .capa-hint::after{animation:none}
  .prop *{transition:none !important}
}
@media (max-width:640px){
  .prop .pagina{padding:76px 20px}
  .prop .card{padding:28px 24px}
  .prop .pacote-heritage{margin-top:34px}
  .prop .entrega-fotos{grid-template-columns:1fr}
  .prop .quote-full blockquote{left:20px;right:20px;top:7%}
  .prop .foto-banner{margin:0 -20px 56px}
  .prop .foto-banner img{height:24vh}
}
`;
