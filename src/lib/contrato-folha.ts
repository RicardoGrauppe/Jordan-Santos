/*
  O editor do contrato com cara de PDF (22/10/2026): folha A4 com as medidas
  de `contrato-pdf/gerar-pdfmake.ts`, quebra de página calculada como o PDF
  quebra, e a tabela de itens e o bloco de assinaturas desenhados de verdade
  em vez de um aviso cinza.

  Só roda no navegador (mede o DOM). `contrato-editor.ts` continua sendo o
  módulo que o servidor também importa; aqui ficam as extensões que o
  EditorContrato põe por cima dele.

  Medidas: o PDF é A4 (595,28 x 841,89 pt) com margem de 56 pt, Roboto 10 pt.
  Em tela, 1 pt = 4/3 px. O CSS da `.folha-a4` (globals.css) usa os mesmos
  números; mudar um lado sem o outro desalinha a quebra.

  A quebra é uma simulação do que o pdfmake faz: bloco que não cabe vai pra
  página seguinte, e parágrafo (inclusive o de item de lista) que não cabe é
  partido na linha que passou do fim da página. As fontes são as mesmas, então
  a diferença fica em detalhe de arredondamento de linha.
*/
import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as NoPM } from "@tiptap/pm/model";
import { BlocoAssinaturas, TabelaItens, type LinhaTabela } from "./contrato-editor";

const PT = 4 / 3;
export const FOLHA = {
  largura: 595.28 * PT,
  altura: 841.89 * PT,
  margem: 56 * PT,
  conteudo: (841.89 - 112) * PT,
  vao: 28,
};

/* ---------- dados do casal pra tabela e assinaturas ----------
   Loja simples fora do React: as NodeViews do Tiptap são DOM puro e precisam
   saber o pacote, o total e a cidade que a lateral está mexendo agora. */

export type ItemFolha = { id: string; nome: string; valor: number; tipo?: string };
export type DadosFolha = {
  noivo?: string | null;
  noiva?: string | null;
  cidade?: string | null;
  itens?: ItemFolha[];
  total?: number | null;
} | null;

let dadosAtuais: DadosFolha = null;
const ouvintes = new Set<() => void>();

export function definirDadosFolha(d: DadosFolha) {
  dadosAtuais = d;
  ouvintes.forEach((f) => f());
}

function ouvirDados(f: () => void): () => void {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}

/* ---------- formatação (o PDF formata igual, em gerar.ts) ---------- */

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = (v: number | null | undefined) => brl.format(Number(v) || 0).replace(/ /g, " ");
const hojeExtenso = () => { const d = new Date(); return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear(); };
const ehPacote = (i: ItemFolha) => i.tipo === "pacote" || (i.tipo !== "adicional" && (["eternal", "heritage"].includes(i.id) || /^pacote\b/i.test(i.nome)));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, classe?: string, texto?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto != null) e.textContent = texto;
  return e;
}

/* ---------- tabela de itens ---------- */

function linhasAutomaticas(d: DadosFolha): LinhaTabela[] {
  const itens = d?.itens ?? [];
  if (!d) return [{ qtd: "1", descricao: "Pacote escolhido pelo casal", valor: null }, { qtd: "1", descricao: "Adicionais", valor: null }];
  const pacote = itens.find(ehPacote);
  return [
    { qtd: "1", descricao: pacote ? pacote.nome : "Serviços fotográficos contratados", valor: null },
    ...itens.filter((i) => !ehPacote(i)).map((a) => ({ qtd: "1", descricao: a.nome, valor: null })),
  ];
}

export const TabelaItensFolha = TabelaItens.extend({
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let atual = node;
      const raiz = el("div", "tabela-folha");
      raiz.contentEditable = "false";

      const salvar = (linhas: LinhaTabela[] | null) => {
        const pos = typeof getPos === "function" ? getPos() : null;
        if (pos == null) return;
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, { ...atual.attrs, linhas }));
      };

      function desenhar() {
        raiz.replaceChildren();
        const manuais = Array.isArray(atual.attrs.linhas) ? (atual.attrs.linhas as LinhaTabela[]) : null;
        const linhas = manuais ?? linhasAutomaticas(dadosAtuais);
        /* no contrato do cliente a tabela é sempre digitável: mexer numa
           célula fixa as linhas (até ali vinham do pacote da lateral). No
           editor de MODELOS não, pra não gravar linhas fixas no modelo. */
        const editavel = editor.isEditable && dadosAtuais != null;

        const tabela = el("table");
        const cab = el("tr");
        ["QTD", "DESCRIÇÃO DOS SERVIÇOS", "VALOR TOTAL"].forEach((t) => cab.append(el("th", undefined, t)));
        const thead = el("thead"); thead.append(cab);
        const tbody = el("tbody");

        linhas.forEach((l, i) => {
          const tr = el("tr");
          const celula = (campo: "qtd" | "descricao" | "valor") => {
            const td = el("td");
            if (!editavel) {
              td.textContent = campo === "valor" ? (l.valor != null ? moeda(l.valor) : "") : String(l[campo] ?? "");
              return td;
            }
            const inp = el("input", "celula-folha");
            inp.value = campo === "valor"
              ? (l.valor != null ? l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "")
              : String(l[campo] ?? "");
            inp.placeholder = campo === "valor" ? "R$" : campo === "qtd" ? "1" : "Descrição";
            inp.setAttribute("aria-label", (campo === "qtd" ? "Quantidade" : campo === "valor" ? "Valor" : "Descrição") + " da linha " + (i + 1));
            inp.addEventListener("change", () => {
              const novas = linhas.map((x) => ({ ...x }));
              if (campo === "valor") {
                const n = parseFloat(inp.value.replace(/\./g, "").replace(",", "."));
                novas[i].valor = inp.value.trim() && isFinite(n) ? n : null;
              } else novas[i][campo] = inp.value;
              salvar(novas);
            });
            td.append(inp);
            return td;
          };
          tr.append(celula("qtd"), celula("descricao"), celula("valor"));
          if (editavel) {
            const x = el("button", "tabela-folha-remover", "×");
            x.type = "button";
            x.title = "Tirar a linha";
            x.setAttribute("aria-label", "Tirar a linha " + (i + 1));
            x.addEventListener("click", () => salvar(linhas.filter((_, j) => j !== i)));
            tr.lastElementChild!.append(x);
          }
          tbody.append(tr);
        });

        const total = el("tr", "total");
        total.append(el("td"), el("td", undefined, "VALOR TOTAL"), el("td", undefined, dadosAtuais ? moeda(dadosAtuais.total) : "R$ 0,00"));
        tbody.append(total);
        tabela.append(thead, tbody);
        raiz.append(tabela);

        if (editavel) {
          /* comandos de edição FORA do fluxo (absolutos): não podem ocupar
             altura, senão a quebra de página daqui não bate com o PDF */
          const barra = el("div", "tabela-folha-barra");
          const botao = (rotulo: string, f: () => void) => {
            const b = el("button", undefined, rotulo); b.type = "button";
            b.addEventListener("click", f); barra.append(b); return b;
          };
          botao("+ Linha", () => salvar([...linhas, { qtd: "1", descricao: "", valor: null }]));
          /* digitou e quer voltar a seguir o pacote da lateral */
          if (manuais) botao("Voltar pro pacote", () => salvar(null));
          raiz.append(barra);
        }
      }

      desenhar();
      const parar = ouvirDados(desenhar);
      return {
        dom: raiz,
        update(novo) {
          if (novo.type !== atual.type) return false;
          atual = novo;
          desenhar();
          return true;
        },
        /* os campos da tabela são do navegador, não do ProseMirror */
        stopEvent: (ev) => (ev.target as HTMLElement)?.closest?.("input, button") != null,
        ignoreMutation: () => true,
        destroy: parar,
      };
    };
  },
});

/* ---------- bloco de assinaturas ---------- */

export const BlocoAssinaturasFolha = BlocoAssinaturas.extend({
  addNodeView() {
    return () => {
      const raiz = el("div", "assinaturas-folha");
      raiz.contentEditable = "false";
      function desenhar() {
        const d = dadosAtuais;
        const casal = d ? [d.noivo, d.noiva].filter(Boolean).join(" e ") || "Contratante" : "Nome do casal";
        raiz.replaceChildren(
          el("p", "ass-local", (d ? (d.cidade || "—") : "Cidade") + ", " + hojeExtenso() + "."),
          el("p", "ass-casal", casal + " – CONTRATANTE"),
          el("p", "ass-jordan", "Jordan Santos – CONTRATADA"),
        );
      }
      desenhar();
      const parar = ouvirDados(desenhar);
      return { dom: raiz, ignoreMutation: () => true, destroy: parar };
    };
  },
});

/* ---------- paginação ---------- */

type Quebra = { pos: number; dentro: boolean; preencher: number };
const chave = new PluginKey<DecorationSet>("paginacao");

function espacador(q: Quebra, pagina: number): HTMLElement {
  const alt = q.preencher + 2 * FOLHA.margem + FOLHA.vao;
  const e = el(q.dentro ? "span" : "div", "quebra-folha");
  e.setAttribute("data-quebra", String(alt));
  e.setAttribute("aria-hidden", "true");
  e.contentEditable = "false";
  e.style.height = alt + "px";
  e.style.setProperty("--vao-topo", q.preencher + FOLHA.margem + "px");
  const rotulo = el("span", "quebra-folha-rotulo", "Página " + pagina);
  e.append(rotulo);
  return e;
}

function montar(doc: NoPM, quebras: Quebra[], sobra: number): DecorationSet {
  const decos = quebras.map((q, i) =>
    Decoration.widget(q.pos, () => espacador(q, i + 2), { side: -1, key: "q" + q.pos + ":" + Math.round(q.preencher) }));
  const fim = el("div", "fim-folha");
  fim.style.height = Math.max(0, sobra) + "px";
  fim.setAttribute("aria-hidden", "true");
  decos.push(Decoration.widget(doc.content.size, fim, { side: 1, key: "fim" + Math.round(sobra) }));
  return DecorationSet.create(doc, decos);
}

function calcular(view: EditorView): { quebras: Quebra[]; sobra: number } {
  const raiz = view.dom as HTMLElement;
  const topo = raiz.getBoundingClientRect().top + FOLHA.margem;
  const espacos = Array.from(raiz.querySelectorAll<HTMLElement>("[data-quebra]"))
    .map((e) => ({ y: e.getBoundingClientRect().top, h: Number(e.getAttribute("data-quebra")) || 0 }));
  /* posição "natural": onde estaria sem os espaçadores que já estão na tela */
  const natural = (y: number) => y - topo - espacos.reduce((s, e) => (e.y < y - 0.5 ? s + e.h : s), 0);

  const quebras: Quebra[] = [];
  let desloc = 0;
  const C = FOLHA.conteudo;
  /* fim da página em que `p` cai (a margem de cima do 1º bloco dá p < 0) */
  const limite = (p: number) => (Math.floor(Math.max(0, p) / C + 1e-6) + 1) * C;

  /* unidades na ordem: bloco de topo, ou cada item de lista */
  const unidades: { el: HTMLElement; pos: number; partivel: HTMLElement | null }[] = [];
  view.state.doc.forEach((no, pos) => {
    const dom = view.nodeDOM(pos) as HTMLElement | null;
    if (!dom || !(dom instanceof HTMLElement)) return;
    if (no.type.name === "orderedList" || no.type.name === "bulletList") {
      no.forEach((li, off) => {
        const liDom = view.nodeDOM(pos + 1 + off) as HTMLElement | null;
        if (liDom instanceof HTMLElement) unidades.push({ el: liDom, pos: pos + 1 + off, partivel: liDom.querySelector("p") });
      });
    } else {
      unidades.push({ el: dom, pos, partivel: no.type.name === "paragraph" ? dom : null });
    }
  });

  for (const u of unidades) {
    const cs = getComputedStyle(u.el);
    const r = u.el.getBoundingClientRect();
    const t = natural(r.top) - (parseFloat(cs.marginTop) || 0);
    const b = natural(r.bottom) + (parseFloat(cs.marginBottom) || 0);
    if (b + desloc <= limite(t + desloc) + 0.5) continue;

    if (u.partivel) {
      /* parágrafo: parte na primeira linha que passa do fim da página */
      const range = document.createRange();
      range.selectNodeContents(u.partivel);
      const linhas: { top: number; bottom: number; left: number }[] = [];
      for (const rr of Array.from(range.getClientRects())) {
        if (rr.height === 0 || rr.width === 0) continue;
        const ult = linhas[linhas.length - 1];
        if (ult && Math.abs(ult.top - rr.top) < 2) { ult.bottom = Math.max(ult.bottom, rr.bottom); ult.left = Math.min(ult.left, rr.left); }
        else linhas.push({ top: rr.top, bottom: rr.bottom, left: rr.left });
      }
      let partiu = false;
      for (let i = 0; i < linhas.length; i++) {
        const lt = natural(linhas[i].top) + desloc;
        const lb = natural(linhas[i].bottom) + desloc;
        const lim = limite(lt);
        if (lb <= lim + 0.5) continue;
        const preencher = lim - lt;
        if (i === 0) {
          quebras.push({ pos: u.pos, dentro: false, preencher: Math.max(0, lim - (t + desloc)) });
          desloc += Math.max(0, lim - (t + desloc));
        } else {
          const alvo = view.posAtCoords({ left: linhas[i].left + 1, top: (linhas[i].top + linhas[i].bottom) / 2 });
          if (!alvo) continue;
          quebras.push({ pos: alvo.pos, dentro: true, preencher });
          desloc += preencher;
        }
        partiu = true;
      }
      if (partiu) continue;
    }
    /* bloco inteiro pra próxima página (não parte: título, tabela, assinaturas) */
    const lim = limite(t + desloc);
    if (t + desloc > lim - C + 0.5) {
      const preencher = lim - (t + desloc);
      quebras.push({ pos: u.pos, dentro: false, preencher });
      desloc += preencher;
    }
  }

  const ultima = unidades[unidades.length - 1];
  const fim = ultima ? natural(ultima.el.getBoundingClientRect().bottom) + desloc : 0;
  const sobra = limite(Math.max(0, fim - 0.5)) - fim;
  return { quebras, sobra };
}

export const Paginacao = Extension.create({
  name: "paginacao",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: chave,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const nova = tr.getMeta(chave) as DecorationSet | undefined;
            return nova ?? set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state: EditorState) { return chave.getState(state); },
        },
        view(view) {
          /* setTimeout e não requestAnimationFrame: rAF não roda em aba de
             fundo, e o editor costuma abrir em guia nova */
          let quadro: ReturnType<typeof setTimeout> | undefined;
          let ultimo = "";
          const agendar = () => {
            clearTimeout(quadro);
            quadro = setTimeout(() => {
              if (!view.dom.isConnected) return;
              const r = calcular(view);
              const assinatura = JSON.stringify(r.quebras.map((q) => [q.pos, Math.round(q.preencher)])) + ":" + Math.round(r.sobra);
              if (assinatura === ultimo) return;
              ultimo = assinatura;
              view.dispatch(view.state.tr.setMeta(chave, montar(view.state.doc, r.quebras, r.sobra)).setMeta("addToHistory", false));
            }, 40);
          };
          agendar();
          const ro = new ResizeObserver(agendar);
          ro.observe(view.dom);
          /* a Roboto chega depois da primeira medida e muda as linhas */
          document.fonts?.ready.then(agendar).catch(() => {});
          return { update: agendar, destroy() { clearTimeout(quadro); ro.disconnect(); } };
        },
      }),
    ];
  },
});

export type { Editor };
