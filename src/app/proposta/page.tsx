/*
  Proposta comercial, /proposta. Portada de `index.html` (o portfólio) do
  estúdio do Jordan Santos. Tela que o CLIENTE do fotógrafo abre: sem
  AppShell, e a voz é a do estúdio falando em primeira pessoa do plural.

  Página 100% estática (decisão de 2026-07-31 no original): pacotes,
  adicionais, álbum e pré-wedding aparecem com nome e preço, sem clique, sem
  seleção, sem calculadora. O casal não escolhe produto nenhum aqui; quem
  escolhe pacote e adicionais é o fotógrafo, no painel, depois que o cliente
  já existe. Por isso não há CTA pro /cadastro: esse link é mandado pelo
  fotógrafo depois de uma conversa, igual ao link de assinatura.

  Preços e itens estão escritos aqui, como no original. Quando o catálogo
  virar dado do fotógrafo, é daqui que eles saem.
*/
/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { fonteSans, fonteSerif } from "@/lib/fontes-marca";
import { RevealAoRolar } from "./RevealAoRolar";

export const metadata: Metadata = {
  title: "Proposta",
  description: "Pacotes de fotografia de casamento, adicionais, álbum e pré-wedding.",
};

/* Contato do estúdio. Herdado do original (ainda placeholder lá: o telefone
   vai migrar pro DDD 41). Quando o perfil do fotógrafo tiver esses campos,
   é aqui que eles entram. */
const CONTATO = {
  telefoneExibido: "(45) 99907-7874",
  telefoneHref: "tel:+5545999077874",
  whatsapp: "https://wa.me/5545999077874?text=Oi%20Jordan!%20Vim%20pelo%20site%20e%20queria%20falar%20sobre%20o%20casamento.",
  email: "jordansantosfotografia@gmail.com",
  instagramUser: "jordansantosphotography",
  instagramHref: "https://instagram.com/jordansantosphotography",
  nomeEstudio: "Jordan Santos Fotografia",
};

const PACOTE_ETERNAL = [
  "Making of dos noivos",
  "Fotos da cerimônia e festa",
  "Galeria de fotos on-line",
  "Tratamento digital de luz, sombra e cor",
  "1 álbum 30x30 (60 páginas) até 100 fotos",
  "Ensaio pré-wedding",
  "1 álbum 28x20 com 40 fotos editadas e tratadas",
  "12 horas de cobertura",
  "2 fotógrafos",
];
const PACOTE_HERITAGE = [
  "Making of dos noivos",
  "Fotos da cerimônia e festa",
  "Galeria de fotos on-line",
  "Tratamento digital de luz, sombra e cor",
  "10 horas de cobertura",
  "2 fotógrafos",
];
const ADICIONAIS: { nome: string; valor: string }[] = [
  { nome: "Welcome Wedding", valor: "R$ 2.790,00" },
  { nome: "Fotógrafo adicional", valor: "R$ 1.150,00" },
  { nome: "Entrega Expressa em 7 dias", valor: "R$ 3.500,00" },
  { nome: "Bride Session · Ensaio editorial da Noiva", valor: "R$ 2.790,00" },
  { nome: "Hora adicional · Cobertura Casamento", valor: "R$ 1.100,00" },
  { nome: "Cobertura fotográfica Casamento Civil", valor: "R$ 2.690,00" },
];

/* ---------- CSS ----------
   Portado do original (ritmo do PDF da proposta) com as regras da casa: o
   selo `.dica` e os cards separam por fundo e sombra, sem borda. O traço do
   `.swoosh` e a linha animada da capa são desenho, não borda. */
const CSS = `
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

function IconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.42a9.87 9.87 0 0 0 4.62 1.18h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.02c-.25.7-1.24 1.29-1.98 1.44-.53.11-1.22.2-3.58-.77-2.99-1.24-4.92-4.28-5.07-4.48-.15-.2-1.21-1.61-1.21-3.07 0-1.46.75-2.17 1.02-2.47.27-.3.58-.37.78-.37.2 0 .39.002.56.01.18.008.42-.07.66.5.25.6.84 2.07.91 2.22.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.31.4-.44.53-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.36 1.45.3.15.48.13.66-.08.18-.2.76-.89.97-1.19.2-.3.4-.25.68-.15.28.1 1.77.83 2.07.98.3.15.5.22.57.35.07.13.07.75-.18 1.45Z" />
    </svg>
  );
}

export default function PaginaProposta() {
  const ano = new Date().getFullYear();

  return (
    <div className={`prop ${fonteSerif.variable} ${fonteSans.variable}`}>
      <style>{CSS}</style>
      <RevealAoRolar />

      {/* capa */}
      <header className="capa">
        <img src="/img/logo-principal-offwhite.png" alt="Jordan Santos" />
        <p className="capa-hint">Role para ver a proposta</p>
      </header>

      {/* foto de abertura */}
      <figure className="foto-full">
        <img src="/img/casal-jardim.jpg" alt="Casal de noivos caminhando de mãos dadas em um jardim" />
      </figure>

      {/* pacotes: exibição estática (sem clique, sem seleção) */}
      <section className="pagina" id="pacotes">
        <div className="miolo-largo">
          <svg className="swoosh" viewBox="0 0 780 760" preserveAspectRatio="none" aria-hidden="true">
            <path d="M660,-20 C700,180 420,240 300,360 C170,490 60,540 110,780" />
          </svg>
          <div className="centro reveal">
            <span className="dica">Conheça os pacotes</span>
            <h2>Pacotes Casamento</h2>
          </div>

          <div className="card pacote-eternal reveal">
            <div className="card-cabecalho">
              <h3>01. Eternal</h3>
            </div>
            <ul>{PACOTE_ETERNAL.map((item) => <li key={item}>{item}</li>)}</ul>
            <span className="preco">R$ 18.600,00</span>
            <span className="parcela">10x 1.860,00</span>
          </div>

          <div className="card pacote-heritage reveal">
            <div className="card-cabecalho">
              <h3>02. Heritage</h3>
            </div>
            <ul>{PACOTE_HERITAGE.map((item) => <li key={item}>{item}</li>)}</ul>
            <span className="preco">R$ 10.850,00</span>
            <span className="parcela">10x 1.085,00</span>
          </div>
        </div>
      </section>

      {/* foto noiva */}
      <figure className="foto-full">
        <img src="/img/noiva-retrato.jpg" alt="Retrato em preto e branco da noiva com véu, sentada" />
      </figure>

      {/* adicionais: exibição estática */}
      <section className="pagina" id="adicionais">
        <div className="secao-conteudo">
          <div className="miolo">
            <div className="centro reveal">
              <span className="dica">Adicionais disponíveis</span>
              <h2>Adicionais</h2>
            </div>
            <div className="reveal">
              {ADICIONAIS.map((a) => (
                <div className="linha" key={a.nome}>
                  <span className="nome">{a.nome}</span>
                  <span className="valor">{a.valor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <img className="secao-bg" src="/img/casal-campo.jpg" alt="" aria-hidden="true" width={1365} height={2048} loading="lazy" />
      </section>

      {/* álbum: exibição estática */}
      <section className="pagina" id="album" style={{ paddingTop: 0 }}>
        <figure className="foto-banner">
          <img src="/img/album.jpg" alt="Álbum de fotografias aberto mostrando as lâminas" />
        </figure>
        <div className="miolo">
          <div className="centro reveal">
            <span className="dica">Opções de álbum</span>
            <h2>Álbum</h2>
          </div>
          <div className="card card-centro reveal">
            <p className="card-desc">Álbum tamanho 30x60 aberto, com 50 páginas (25 lâminas) e 100 imagens</p>
            <span className="preco">R$ 5.500,00</span>
          </div>
          <div className="card card-centro reveal">
            <p className="card-desc">Álbum tamanho 20x60 aberto, com 40 páginas (20 lâminas) e 60 imagens</p>
            <span className="preco">R$ 3.600,00</span>
          </div>
        </div>
      </section>

      {/* pré-wedding: exibição estática */}
      <section className="pagina" id="prewedding">
        <div className="secao-conteudo">
          <div className="miolo">
            <div className="centro reveal">
              <span className="dica">Ensaio opcional</span>
              <h2>Pré Wedding</h2>
            </div>
            <div className="linha reveal">
              <span className="nome">
                Ensaio Pré Wedding
                <small>1 hora e meia de sessão de fotos digitais · Tratamento de sombra, luz e cor · Galeria on-line</small>
              </span>
              <span className="valor">R$ 2.600,00</span>
            </div>
          </div>
        </div>
        <img className="secao-bg" src="/img/prewedding.jpg" alt="" aria-hidden="true" width={1365} height={2048} loading="lazy" />
        <p className="prewed-legenda">Nosso trabalho depende da verdade de vocês,<br />quanto mais reais forem com a gente, mais verdadeira será a foto.</p>
      </section>

      {/* entrega */}
      <section className="pagina" id="entrega">
        <div className="miolo">
          <div className="centro reveal">
            <h2>Entrega</h2>
          </div>
          <div className="entrega-texto reveal" style={{ marginTop: 34 }}>
            <p>Cada fotografia recebe um tratamento cuidadoso de luz, cor e contraste, sem manipulações artificiais, preservando a autenticidade e a beleza natural de cada momento vivido.</p>
            <p>Todo o material é registrado com equipamentos profissionais de alta qualidade, e as imagens são disponibilizadas aos noivos por meio de uma galeria online exclusiva, garantindo praticidade e máxima qualidade na entrega.</p>
          </div>
          <div className="entrega-fotos reveal">
            <img src="/img/entrega-1.jpg" alt="Noivos em um corredor clássico" />
            <img src="/img/entrega-2.jpg" alt="Noiva em um salão histórico" />
            <img src="/img/entrega-3.jpg" alt="Retrato próximo dos noivos" />
          </div>
        </div>
      </section>

      {/* citação */}
      <figure className="quote-full">
        <img src="/img/casal-palacio.jpg" alt="Noivos em um palácio, em preto e branco" />
        <blockquote>“Com um olhar artístico e foco na autenticidade, entregamos imagens sofisticadas que refletem a essência do seu casamento.”</blockquote>
      </figure>

      {/* chamada final: só o botão de contato, sem total nem seleção */}
      <section className="pagina" id="fale-conosco">
        <div className="miolo centro reveal">
          <span className="dica">Vamos conversar</span>
          <h2>Vamos começar?</h2>
          <p className="fale-conosco-texto">Nos conte a data do seu casamento e confirmamos a disponibilidade com você direto pelo WhatsApp.</p>
          <a className="cta cta-whats" href={CONTATO.whatsapp} target="_blank" rel="noopener">
            <IconeWhatsApp />
            Chamar no WhatsApp
          </a>
        </div>
      </section>

      {/* fechamento */}
      <footer className="fim">
        <img src="/img/assinatura-offwhite.png" alt="Assinatura de Jordan Santos" />
        <p>Será uma honra eternizar seu momento.<br />Estamos à disposição para conversarmos sobre cada detalhe.</p>
        <div>
          <a href={CONTATO.telefoneHref}>{CONTATO.telefoneExibido}</a>
          <a href={CONTATO.whatsapp} target="_blank" rel="noopener">WhatsApp</a>
          <a href={"mailto:" + CONTATO.email}>{CONTATO.email}</a>
          <a href={CONTATO.instagramHref} target="_blank" rel="noopener">@{CONTATO.instagramUser}</a>
        </div>
        <p className="ano">© {ano} {CONTATO.nomeEstudio}</p>
      </footer>
    </div>
  );
}
