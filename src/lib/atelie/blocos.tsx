/*
  Blocos do Ateliê: as peças com que o fotógrafo monta o site.

  Cada bloco é um pedaço da proposta do Jordan (o `index.html` original, que
  virou o /proposta) com o mesmo HTML e as mesmas classes, só que com texto,
  fotos e preços vindo dos campos em vez de fixos. O estilo é o
  `CSS_PROPOSTA`, aplicado uma vez na raiz (`.prop`). A conversão foi medida
  pelo DOM contra a página antiga, em 1440px e no celular: mesmo resultado.

  O mesmo `configAtelie` alimenta o editor (<Puck>, no cliente) e o site
  público (<Render>, no servidor). Por isso nada aqui usa hook nem contexto.

  Contato do estúdio (telefone, WhatsApp, e-mail, Instagram) é campo da
  PÁGINA, não de bloco: aparece na chamada e no rodapé, e trocar o número num
  lugar só não pode deixar o outro desatualizado. Os blocos leem esses dados
  pelo `metadata` do Puck, que quem renderiza preenche com os campos da raiz
  (ver `contatoDaPagina`).

  No editor a página vive num iframe: o RevealAoRolar procura os `.reveal` no
  documento de fora e não acharia nada, então em edição a raiz ganha
  `.editando`, que mostra tudo sem animação.
*/
/* eslint-disable @next/next/no-img-element */
import type { Config, Data } from "@puckeditor/core";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { fonteSans, fonteSerif } from "@/lib/fontes-marca";
import { RevealAoRolar } from "@/app/proposta/RevealAoRolar";
import { CSS_PROPOSTA } from "./proposta-css";

/* ---------- tipos ---------- */

export type RaizProps = {
  titulo: string;
  nomeEstudio: string;
  telefone: string;
  whatsapp: string;
  mensagemWhatsapp: string;
  email: string;
  instagram: string;
};

type Foto = { src: string; alt: string; foco: string };
type PacoteItem = { nome: string; itens: string; preco: string; parcela: string };
type LinhaPreco = { nome: string; detalhe: string; valor: string };

type CapaProps = { logo: string; logoAlt: string; frase: string };
type FotoInteiraProps = Foto;
type PacotesProps = { ancora: string; selo: string; titulo: string; pacotes: PacoteItem[] };
type ListaSobreFotoProps = {
  ancora: string;
  selo: string;
  titulo: string;
  linhas: LinhaPreco[];
  foto: string;
  foco: string;
  legenda: string;
  corCeu: string;
  subida: number;
};
type CartoesProps = {
  ancora: string;
  faixa: string;
  faixaAlt: string;
  selo: string;
  titulo: string;
  cartoes: { descricao: string; preco: string }[];
};
type TextoComFotosProps = {
  ancora: string;
  selo: string;
  titulo: string;
  paragrafos: { texto: string }[];
  fotos: Foto[];
};
type CitacaoProps = Foto & { texto: string };
type ChamadaProps = { ancora: string; selo: string; titulo: string; texto: string; botao: string };
type RodapeProps = { assinatura: string; assinaturaAlt: string; frase: string };

export type Blocos = {
  Capa: CapaProps;
  FotoInteira: FotoInteiraProps;
  Pacotes: PacotesProps;
  ListaSobreFoto: ListaSobreFotoProps;
  Cartoes: CartoesProps;
  TextoComFotos: TextoComFotosProps;
  Citacao: CitacaoProps;
  Chamada: ChamadaProps;
  Rodape: RodapeProps;
};

export type DadosSite = Data<Blocos, RaizProps>;

/* ---------- contato ---------- */

type Contato = {
  nomeEstudio: string;
  telefone: string;
  telefoneHref: string;
  whatsappHref: string;
  email: string;
  instagram: string;
};

/** Contato do estúdio montado a partir dos campos da página: vai como
    `metadata` pro Render e pro editor, e os blocos leem de lá. */
export function contatoDaPagina(raiz: Partial<RaizProps> | undefined): Contato {
  const numero = (raiz?.whatsapp || "").replace(/\D/g, "");
  const mensagem = raiz?.mensagemWhatsapp?.trim();
  return {
    nomeEstudio: raiz?.nomeEstudio || "",
    telefone: raiz?.telefone || "",
    telefoneHref: numero ? "tel:+" + numero : "",
    whatsappHref: numero ? "https://wa.me/" + numero + (mensagem ? "?text=" + encodeURIComponent(mensagem) : "") : "",
    email: raiz?.email || "",
    instagram: (raiz?.instagram || "").replace(/^@/, ""),
  };
}

function contatoDe(metadata: Record<string, unknown> | undefined): Contato {
  return (metadata?.contato as Contato | undefined) ?? contatoDaPagina(undefined);
}

/* ---------- auxiliares ---------- */

/** Foco da foto (object-position) só vira style quando existe: sem foco, o
    navegador centraliza, que é o padrão. */
function estiloFoco(foco: string): CSSProperties | undefined {
  return foco.trim() ? { objectPosition: foco.trim() } : undefined;
}

/** Texto de várias linhas: cada quebra no campo vira <br> na página. */
function comQuebras(texto: string): ReactNode {
  const linhas = texto.split("\n");
  return linhas.map((l, i) => (
    <Fragment key={i}>
      {l}
      {i < linhas.length - 1 && <br />}
    </Fragment>
  ));
}

/** Lista de itens escrita um por linha no campo. */
function itensPorLinha(texto: string): string[] {
  return texto.split("\n").map((l) => l.trim()).filter(Boolean);
}

/* Os cards dos pacotes alternam esquerda e direita, como no PDF da proposta. */
const LADO_DO_PACOTE = ["pacote-esq", "pacote-dir"];

const CSS_EDICAO = `.prop.editando .reveal{opacity:1;transform:none;transition:none}`;

function IconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.42a9.87 9.87 0 0 0 4.62 1.18h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.02c-.25.7-1.24 1.29-1.98 1.44-.53.11-1.22.2-3.58-.77-2.99-1.24-4.92-4.28-5.07-4.48-.15-.2-1.21-1.61-1.21-3.07 0-1.46.75-2.17 1.02-2.47.27-.3.58-.37.78-.37.2 0 .39.002.56.01.18.008.42-.07.66.5.25.6.84 2.07.91 2.22.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.31.4-.44.53-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.36 1.45.3.15.48.13.66-.08.18-.2.76-.89.97-1.19.2-.3.4-.25.68-.15.28.1 1.77.83 2.07.98.3.15.5.22.57.35.07.13.07.75-.18 1.45Z" />
    </svg>
  );
}

/* ---------- campos repetidos ---------- */

const campoAncora = { type: "text" as const, label: "Âncora (pra links com #)" };
const campoSelo = { type: "text" as const, label: "Selo", contentEditable: true };
const campoTitulo = { type: "text" as const, label: "Título", contentEditable: true };
const campoFoco = { type: "text" as const, label: "Foco da foto (ex.: 50% 30%)" };

/* ---------- config ---------- */

export const configAtelie: Config<Blocos, RaizProps> = {
  root: {
    fields: {
      titulo: { type: "text", label: "Título da página (aba do navegador)" },
      nomeEstudio: { type: "text", label: "Nome do estúdio" },
      telefone: { type: "text", label: "Telefone (como aparece)" },
      whatsapp: { type: "text", label: "WhatsApp com DDI (só números)" },
      mensagemWhatsapp: { type: "textarea", label: "Mensagem pronta do WhatsApp" },
      email: { type: "text", label: "E-mail" },
      instagram: { type: "text", label: "Instagram (usuário)" },
    },
    render: ({ children, puck }) => (
      <div className={`prop ${fonteSerif.variable} ${fonteSans.variable}${puck.isEditing ? " editando" : ""}`}>
        <style>{CSS_PROPOSTA + CSS_EDICAO}</style>
        {!puck.isEditing && <RevealAoRolar />}
        {children}
      </div>
    ),
  },
  components: {
    Capa: {
      label: "Capa",
      fields: {
        logo: { type: "text", label: "Logo (endereço da imagem)" },
        logoAlt: { type: "text", label: "Descrição do logo" },
        frase: { type: "text", label: "Frase", contentEditable: true },
      },
      defaultProps: { logo: "/img/logo-principal-offwhite.png", logoAlt: "", frase: "Role para ver mais" },
      render: ({ logo, logoAlt, frase }) => (
        <header className="capa">
          <img src={logo} alt={logoAlt} />
          <p className="capa-hint">{frase}</p>
        </header>
      ),
    },

    FotoInteira: {
      label: "Foto inteira",
      fields: {
        src: { type: "text", label: "Foto (endereço da imagem)" },
        alt: { type: "text", label: "Descrição da foto" },
        foco: campoFoco,
      },
      defaultProps: { src: "/img/casal-jardim.jpg", alt: "", foco: "" },
      render: ({ src, alt, foco }) => (
        <figure className="foto-full">
          <img src={src} alt={alt} style={estiloFoco(foco)} />
        </figure>
      ),
    },

    Pacotes: {
      label: "Pacotes",
      fields: {
        ancora: campoAncora,
        selo: campoSelo,
        titulo: campoTitulo,
        pacotes: {
          type: "array",
          label: "Pacotes",
          getItemSummary: (p) => p.nome || "Pacote",
          defaultItemProps: { nome: "Novo pacote", itens: "", preco: "", parcela: "" },
          arrayFields: {
            nome: { type: "text", label: "Nome" },
            itens: { type: "textarea", label: "Itens (um por linha)" },
            preco: { type: "text", label: "Preço" },
            parcela: { type: "text", label: "Parcelamento" },
          },
        },
      },
      defaultProps: { ancora: "", selo: "Conheça os pacotes", titulo: "Pacotes", pacotes: [] },
      render: ({ ancora, selo, titulo, pacotes }) => (
        <section className="pagina" id={ancora || undefined}>
          <div className="miolo-largo">
            <svg className="swoosh" viewBox="0 0 780 760" preserveAspectRatio="none" aria-hidden="true">
              <path d="M660,-20 C700,180 420,240 300,360 C170,490 60,540 110,780" />
            </svg>
            <div className="centro reveal">
              {selo && <span className="dica">{selo}</span>}
              <h2>{titulo}</h2>
            </div>
            {pacotes.map((p, i) => (
              <div className={`card ${LADO_DO_PACOTE[i % 2]} reveal`} key={i}>
                <div className="card-cabecalho">
                  <h3>{p.nome}</h3>
                </div>
                <ul>{itensPorLinha(p.itens).map((item, j) => <li key={j}>{item}</li>)}</ul>
                {p.preco && <span className="preco">{p.preco}</span>}
                {p.parcela && <span className="parcela">{p.parcela}</span>}
              </div>
            ))}
          </div>
        </section>
      ),
    },

    ListaSobreFoto: {
      label: "Lista de preços sobre foto",
      fields: {
        ancora: campoAncora,
        selo: campoSelo,
        titulo: campoTitulo,
        linhas: {
          type: "array",
          label: "Linhas",
          getItemSummary: (l) => l.nome || "Linha",
          defaultItemProps: { nome: "Novo item", detalhe: "", valor: "" },
          arrayFields: {
            nome: { type: "text", label: "Nome" },
            detalhe: { type: "text", label: "Detalhe (opcional)" },
            valor: { type: "text", label: "Valor" },
          },
        },
        foto: { type: "text", label: "Foto de fundo (endereço da imagem)" },
        foco: campoFoco,
        legenda: { type: "textarea", label: "Legenda sobre a foto (opcional)" },
        corCeu: { type: "text", label: "Cor do céu no celular" },
        subida: { type: "number", label: "Quanto a foto sobe no celular", min: 0, max: 100 },
      },
      defaultProps: {
        ancora: "", selo: "", titulo: "Adicionais", linhas: [], foto: "/img/casal-campo.jpg",
        foco: "", legenda: "", corCeu: "#FEFEFE", subida: 40,
      },
      render: ({ ancora, selo, titulo, linhas, foto, foco, legenda, corCeu, subida }) => {
        const desenhaLinha = (l: LinhaPreco, i: number, extra = "") => (
          <div className={"linha" + extra} key={i}>
            <span className="nome">
              {l.nome}
              {l.detalhe && <small>{l.detalhe}</small>}
            </span>
            <span className="valor">{l.valor}</span>
          </div>
        );
        return (
          <section
            className="pagina sobre-foto"
            id={ancora || undefined}
            style={{ "--ceu": corCeu || undefined, "--subida": subida } as CSSProperties}
          >
            <div className="secao-conteudo">
              <div className="miolo">
                <div className="centro reveal">
                  {selo && <span className="dica">{selo}</span>}
                  <h2>{titulo}</h2>
                </div>
                {/* uma linha só anima sozinha; várias entram juntas */}
                {linhas.length === 1
                  ? desenhaLinha(linhas[0], 0, " reveal")
                  : <div className="reveal">{linhas.map((l, i) => desenhaLinha(l, i))}</div>}
              </div>
            </div>
            <img className="secao-bg" src={foto} alt="" aria-hidden="true" width={1365} height={2048} loading="lazy" style={estiloFoco(foco)} />
            {legenda.trim() && <p className="legenda-sobre-foto">{comQuebras(legenda.trim())}</p>}
          </section>
        );
      },
    },

    Cartoes: {
      label: "Cartões com preço",
      fields: {
        ancora: campoAncora,
        faixa: { type: "text", label: "Foto em faixa no topo (opcional)" },
        faixaAlt: { type: "text", label: "Descrição da foto em faixa" },
        selo: campoSelo,
        titulo: campoTitulo,
        cartoes: {
          type: "array",
          label: "Cartões",
          getItemSummary: (c) => c.descricao.slice(0, 40) || "Cartão",
          defaultItemProps: { descricao: "Descrição", preco: "" },
          arrayFields: {
            descricao: { type: "textarea", label: "Descrição" },
            preco: { type: "text", label: "Preço" },
          },
        },
      },
      defaultProps: { ancora: "", faixa: "", faixaAlt: "", selo: "", titulo: "Álbum", cartoes: [] },
      render: ({ ancora, faixa, faixaAlt, selo, titulo, cartoes }) => (
        <section className="pagina" id={ancora || undefined} style={faixa ? { paddingTop: 0 } : undefined}>
          {faixa && (
            <figure className="foto-banner">
              <img src={faixa} alt={faixaAlt} />
            </figure>
          )}
          <div className="miolo">
            <div className="centro reveal">
              {selo && <span className="dica">{selo}</span>}
              <h2>{titulo}</h2>
            </div>
            {cartoes.map((c, i) => (
              <div className="card card-centro reveal" key={i}>
                <p className="card-desc">{c.descricao}</p>
                {c.preco && <span className="preco">{c.preco}</span>}
              </div>
            ))}
          </div>
        </section>
      ),
    },

    TextoComFotos: {
      label: "Texto com fotos",
      fields: {
        ancora: campoAncora,
        selo: campoSelo,
        titulo: campoTitulo,
        paragrafos: {
          type: "array",
          label: "Parágrafos",
          getItemSummary: (p) => p.texto.slice(0, 40) || "Parágrafo",
          defaultItemProps: { texto: "" },
          arrayFields: { texto: { type: "textarea", label: "Texto" } },
        },
        fotos: {
          type: "array",
          label: "Fotos",
          getItemSummary: (f) => f.alt || "Foto",
          defaultItemProps: { src: "", alt: "", foco: "" },
          arrayFields: {
            src: { type: "text", label: "Foto (endereço da imagem)" },
            alt: { type: "text", label: "Descrição da foto" },
            foco: campoFoco,
          },
        },
      },
      defaultProps: { ancora: "", selo: "", titulo: "Entrega", paragrafos: [], fotos: [] },
      render: ({ ancora, selo, titulo, paragrafos, fotos }) => (
        <section className="pagina" id={ancora || undefined}>
          <div className="miolo">
            <div className="centro reveal">
              {selo && <span className="dica">{selo}</span>}
              <h2>{titulo}</h2>
            </div>
            {paragrafos.length > 0 && (
              <div className="entrega-texto reveal" style={{ marginTop: 34 }}>
                {paragrafos.map((p, i) => <p key={i}>{p.texto}</p>)}
              </div>
            )}
            {fotos.length > 0 && (
              <div className="entrega-fotos reveal">
                {fotos.map((f, i) => <img key={i} src={f.src} alt={f.alt} style={estiloFoco(f.foco)} />)}
              </div>
            )}
          </div>
        </section>
      ),
    },

    Citacao: {
      label: "Citação sobre foto",
      fields: {
        texto: { type: "textarea", label: "Citação", contentEditable: true },
        src: { type: "text", label: "Foto (endereço da imagem)" },
        alt: { type: "text", label: "Descrição da foto" },
        foco: campoFoco,
      },
      defaultProps: { texto: "", src: "/img/casal-palacio.jpg", alt: "", foco: "" },
      render: ({ texto, src, alt, foco }) => (
        <figure className="quote-full">
          <img src={src} alt={alt} style={estiloFoco(foco)} />
          <blockquote>{texto}</blockquote>
        </figure>
      ),
    },

    Chamada: {
      label: "Chamada pro WhatsApp",
      fields: {
        ancora: campoAncora,
        selo: campoSelo,
        titulo: campoTitulo,
        texto: { type: "textarea", label: "Texto", contentEditable: true },
        botao: { type: "text", label: "Texto do botão" },
      },
      defaultProps: { ancora: "", selo: "Vamos conversar", titulo: "Vamos começar?", texto: "", botao: "Chamar no WhatsApp" },
      render: ({ ancora, selo, titulo, texto, botao, puck }) => {
        const contato = contatoDe(puck.metadata);
        return (
          <section className="pagina" id={ancora || undefined}>
            <div className="miolo centro reveal">
              {selo && <span className="dica">{selo}</span>}
              <h2>{titulo}</h2>
              {texto && <p className="fale-conosco-texto">{texto}</p>}
              {contato.whatsappHref && (
                <a className="cta cta-whats" href={contato.whatsappHref} target="_blank" rel="noopener">
                  <IconeWhatsApp />
                  {botao}
                </a>
              )}
            </div>
          </section>
        );
      },
    },

    Rodape: {
      label: "Rodapé com contatos",
      fields: {
        assinatura: { type: "text", label: "Assinatura (endereço da imagem)" },
        assinaturaAlt: { type: "text", label: "Descrição da assinatura" },
        frase: { type: "textarea", label: "Frase" },
      },
      defaultProps: { assinatura: "/img/assinatura-offwhite.png", assinaturaAlt: "", frase: "" },
      render: ({ assinatura, assinaturaAlt, frase, puck }) => {
        const contato = contatoDe(puck.metadata);
        return (
          <footer className="fim">
            {assinatura && <img src={assinatura} alt={assinaturaAlt} />}
            {frase.trim() && <p>{comQuebras(frase.trim())}</p>}
            <div>
              {contato.telefoneHref && <a href={contato.telefoneHref}>{contato.telefone}</a>}
              {contato.whatsappHref && <a href={contato.whatsappHref} target="_blank" rel="noopener">WhatsApp</a>}
              {contato.email && <a href={"mailto:" + contato.email}>{contato.email}</a>}
              {contato.instagram && (
                <a href={"https://instagram.com/" + contato.instagram} target="_blank" rel="noopener">@{contato.instagram}</a>
              )}
            </div>
            <p className="ano">© {new Date().getFullYear()} {contato.nomeEstudio}</p>
          </footer>
        );
      },
    },
  },
};
