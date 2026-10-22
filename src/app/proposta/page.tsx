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
import { CSS_PROPOSTA } from "@/lib/atelie/proposta-css";

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
      <style>{CSS_PROPOSTA}</style>
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
