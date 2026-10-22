/*
  Blocos do Ateliê (prova de conceito com o Puck, 22/10/2026).

  Cada bloco é um pedaço da proposta do Jordan (`/proposta`) com o MESMO HTML
  e as mesmas classes, só que com o texto vindo dos campos em vez de fixo. O
  estilo é o `CSS_PROPOSTA`, aplicado uma vez na raiz (`.prop`), como na
  página original. A prova serve pra medir se o resultado sai idêntico.

  O mesmo `config` alimenta o editor (<Puck>, no cliente) e a página pública
  (<Render>, no servidor). No editor a página vive num iframe: o
  RevealAoRolar procura os `.reveal` no documento de fora e não acharia nada,
  então em edição a raiz ganha `.editando`, que mostra tudo sem animação.
*/
/* eslint-disable @next/next/no-img-element */
import type { Config } from "@puckeditor/core";
import { fonteSans, fonteSerif } from "@/lib/fontes-marca";
import { RevealAoRolar } from "@/app/proposta/RevealAoRolar";
import { CSS_PROPOSTA } from "./proposta-css";

type CapaProps = { logo: string; logoAlt: string; frase: string };
type FotoInteiraProps = { src: string; alt: string };
type PacoteItem = { nome: string; itens: string; preco: string; parcela: string };
type PacotesProps = { selo: string; titulo: string; pacotes: PacoteItem[] };
type LinhaPreco = { nome: string; valor: string };
type AdicionaisProps = { selo: string; titulo: string; linhas: LinhaPreco[]; foto: string };

type Blocos = {
  Capa: CapaProps;
  FotoInteira: FotoInteiraProps;
  Pacotes: PacotesProps;
  Adicionais: AdicionaisProps;
};

/* Os cards dos pacotes alternam esquerda/direita, como no PDF. As classes
   ainda têm o nome dos pacotes do Jordan porque o CSS é o da proposta. */
const LADO_DO_PACOTE = ["pacote-eternal", "pacote-heritage"];

const CSS_EDICAO = `.prop.editando .reveal{opacity:1;transform:none;transition:none}`;

export const configAtelie: Config<Blocos> = {
  root: {
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
      defaultProps: { logo: "/img/logo-principal-offwhite.png", logoAlt: "", frase: "Role para ver a proposta" },
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
      },
      defaultProps: { src: "/img/casal-jardim.jpg", alt: "" },
      render: ({ src, alt }) => (
        <figure className="foto-full">
          <img src={src} alt={alt} />
        </figure>
      ),
    },
    Pacotes: {
      label: "Pacotes",
      fields: {
        selo: { type: "text", label: "Selo", contentEditable: true },
        titulo: { type: "text", label: "Título", contentEditable: true },
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
      defaultProps: { selo: "Conheça os pacotes", titulo: "Pacotes", pacotes: [] },
      render: ({ selo, titulo, pacotes }) => (
        <section className="pagina" id="pacotes">
          <div className="miolo-largo">
            <svg className="swoosh" viewBox="0 0 780 760" preserveAspectRatio="none" aria-hidden="true">
              <path d="M660,-20 C700,180 420,240 300,360 C170,490 60,540 110,780" />
            </svg>
            <div className="centro reveal">
              <span className="dica">{selo}</span>
              <h2>{titulo}</h2>
            </div>
            {pacotes.map((p, i) => (
              <div className={`card ${LADO_DO_PACOTE[i % 2]} reveal`} key={i}>
                <div className="card-cabecalho">
                  <h3>{p.nome}</h3>
                </div>
                <ul>
                  {p.itens.split("\n").map((l) => l.trim()).filter(Boolean).map((item) => <li key={item}>{item}</li>)}
                </ul>
                <span className="preco">{p.preco}</span>
                <span className="parcela">{p.parcela}</span>
              </div>
            ))}
          </div>
        </section>
      ),
    },
    Adicionais: {
      label: "Lista de preços sobre foto",
      fields: {
        selo: { type: "text", label: "Selo", contentEditable: true },
        titulo: { type: "text", label: "Título", contentEditable: true },
        linhas: {
          type: "array",
          label: "Linhas",
          getItemSummary: (l) => l.nome || "Linha",
          defaultItemProps: { nome: "Novo item", valor: "" },
          arrayFields: {
            nome: { type: "text", label: "Nome" },
            valor: { type: "text", label: "Valor" },
          },
        },
        foto: { type: "text", label: "Foto de fundo (endereço da imagem)" },
      },
      defaultProps: { selo: "Adicionais disponíveis", titulo: "Adicionais", linhas: [], foto: "/img/casal-campo.jpg" },
      render: ({ selo, titulo, linhas, foto }) => (
        <section className="pagina" id="adicionais">
          <div className="secao-conteudo">
            <div className="miolo">
              <div className="centro reveal">
                <span className="dica">{selo}</span>
                <h2>{titulo}</h2>
              </div>
              <div className="reveal">
                {linhas.map((a, i) => (
                  <div className="linha" key={i}>
                    <span className="nome">{a.nome}</span>
                    <span className="valor">{a.valor}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <img className="secao-bg" src={foto} alt="" aria-hidden="true" width={1365} height={2048} loading="lazy" />
        </section>
      ),
    },
  },
};
