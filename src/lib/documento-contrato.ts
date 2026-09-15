/*
  Rotinas do documento de contrato NA TELA: a via de leitura em folhas A4 que
  o casal lê em /assinar (e que o fotógrafo revisa no painel). Extraído do
  port de `revisar-contrato.html` (src/app/painel/clientes/[id]/contrato/
  page.tsx), lógica idêntica, pra /assinar não carregar uma segunda cópia.
  Aquele arquivo ainda tem a cópia própria; quando for mexer nele, dá pra
  trocar pelas funções daqui.

  Só roda no browser: preenche innerHTML e mede altura real em pixel.

  Decisões herdadas do original, que não devem ser redescobertas:
  - O #documento é HTML cru (snapshot do contrato ou o texto fixo em
    lib/contrato-template.ts), preenchido via [data-campo] e dividido em
    folhas por MEDIÇÃO de altura. Vive fora do React.
  - Paginar precisa acontecer com o container VISÍVEL, já com os valores de
    verdade preenchidos (placeholder "________" mede altura errada) e com as
    imagens carregadas (logo sem altura também mede errado).
*/
import { moeda } from "@/lib/util";

export type ItemContratado = { id?: string | null; nome?: string | null };

/** Snapshot congelado do cliente na geração do contrato (mesma forma do banco). */
export type SnapshotContrato = {
  noivo?: string | null; cpf_noivo?: string | null; noiva?: string | null; cpf_noiva?: string | null;
  tel_noivo?: string | null; tel_noiva?: string | null; email?: string | null;
  cep?: string | null; endereco?: string | null; numero?: string | null; complemento?: string | null;
  bairro?: string | null; cidade?: string | null; estado?: string | null;
  data_evento?: string | null; horario?: string | null; local_evento?: string | null;
  itens?: ItemContratado[] | null; total?: number | string | null; entrada?: number | string | null;
};

/* ---------- formatação ---------- */

export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatarCpf(v: unknown): string {
  const d = String(v ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length !== 11) return d || "________________";
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function dataExtenso(d: Date): string {
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return d.getDate() + " de " + meses[d.getMonth()] + " de " + d.getFullYear();
}

export function dataEventoExtenso(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "________________";
  const p = iso.split("-");
  return dataExtenso(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
}

/* ---------- preenchimento ---------- */

/* O contrato LISTA o pacote e os adicionais, um por linha, mas sem NENHUM
   valor unitário, só o VALOR TOTAL no rodapé. Tem que bater EXATAMENTE com o
   gerador de PDF (lib/contrato-pdf): o que se lê na tela é o que vai pro PDF
   assinado. A detecção de pacote é a mesma do servidor: id conhecido, com o
   nome como rede de segurança. */
const IDS_PACOTE: Record<string, true> = { eternal: true, heritage: true };
export function ehPacote(it: ItemContratado | null | undefined): boolean {
  return !!(it && it.id && IDS_PACOTE[it.id]) || /^pacote\b/i.test(String(it?.nome ?? ""));
}

export function montaTabela(container: HTMLElement, itens: ItemContratado[], total: number) {
  const tbody = container.querySelector<HTMLTableSectionElement>("#tabela-servicos");
  if (!tbody) return;
  tbody.innerHTML = "";
  const pacote = itens.filter(ehPacote)[0];
  const descricoes = [pacote ? (pacote.nome || pacote.id || "") : "Serviços fotográficos contratados"];
  itens.filter((i) => !ehPacote(i)).forEach((a) => { descricoes.push(a.nome || a.id || ""); });

  descricoes.forEach((texto) => {
    const tr = document.createElement("tr");
    const qtd = document.createElement("td"); qtd.textContent = "1"; qtd.className = "num";
    const desc = document.createElement("td"); desc.textContent = texto;
    const val = document.createElement("td"); val.className = "num";
    tr.append(qtd, desc, val);
    tbody.appendChild(tr);
  });

  const trTotal = document.createElement("tr");
  const v = document.createElement("td");
  const r = document.createElement("td"); r.textContent = "VALOR TOTAL"; r.style.fontWeight = "500";
  const t = document.createElement("td"); t.textContent = moeda(total); t.className = "num"; t.style.fontWeight = "500";
  trTotal.append(v, r, t);
  tbody.appendChild(trTotal);
}

export function preencherCampo(container: HTMLElement, nome: string, valor: string | null | undefined) {
  container.querySelectorAll<HTMLElement>('[data-campo="' + nome + '"]').forEach((span) => {
    span.textContent = valor || "________________";
  });
}

/**
 * Preenche todos os [data-campo] do contrato com o snapshot, mais a tabela de
 * serviços. Mesma lista de campos, na mesma ordem, do original.
 * Devolve total e entrada já resolvidos (entrada padrão: 30% do total).
 */
export function preencherContrato(container: HTMLElement, s: SnapshotContrato): { total: number; entrada: number } {
  const total = Number(s.total) || 0;
  const entrada = s.entrada != null && s.entrada !== "" ? Number(s.entrada) : total * 0.3;
  montaTabela(container, Array.isArray(s.itens) ? s.itens : [], total);
  preencherCampo(container, "noivo", s.noivo);
  preencherCampo(container, "noiva", s.noiva);
  preencherCampo(container, "cpf-noivo", s.cpf_noivo ? formatarCpf(s.cpf_noivo) : "");
  preencherCampo(container, "cpf-noiva", s.cpf_noiva ? formatarCpf(s.cpf_noiva) : "");
  preencherCampo(container, "endereco", s.endereco);
  preencherCampo(container, "numero", s.numero);
  preencherCampo(container, "bairro", s.bairro);
  preencherCampo(container, "cidade", s.cidade);
  preencherCampo(container, "complemento", s.complemento || "N/A");
  preencherCampo(container, "estado", s.estado);
  preencherCampo(container, "cep", s.cep);
  preencherCampo(container, "tel-noivo", s.tel_noivo);
  preencherCampo(container, "tel-noiva", s.tel_noiva);
  preencherCampo(container, "data-formatada", dataEventoExtenso(s.data_evento));
  preencherCampo(container, "local", s.local_evento);
  preencherCampo(container, "horario", s.horario ? String(s.horario).slice(0, 5) : "");
  preencherCampo(container, "valor-total", moeda(total));
  preencherCampo(container, "valor-entrada", moeda(entrada));
  preencherCampo(container, "cidade-assinatura", s.cidade);
  preencherCampo(container, "data-assinatura", dataExtenso(new Date()));
  return { total, entrada };
}

/* ---------- folhas A4 ----------
   Medição na mão (o Paged.js foi tentado e revertido no original: ele larga
   uma cópia do documento em document.body por fora de qualquer container).
   Cria uma folha de prova pra pegar a largura/padding REAIS desta tela (o
   celular usa padding menor) e um medidor invisível pra saber a altura que
   cada nó vai ocupar, antes de decidir quantos cabem por página. Um <ol> com
   vários itens vira uma unidade por <li>, que pode ficar numa folha e
   continuar na próxima com a numeração preservada via "start". */
type Unidade =
  | { no: HTMLElement; li?: undefined }
  | { li: HTMLElement; tag: "OL" | "UL"; classe: string; numero: number | null; no?: undefined };

export function paginarDocumento(container: HTMLElement) {
  /* template salvo pelo editor exporta tudo dentro de um <section class="secao">
     só; sem desembrulhar, a paginação vê UM nó gigante */
  const secao = container.querySelector<HTMLElement>(":scope > .secao");
  if (secao) {
    while (secao.firstChild) container.appendChild(secao.firstChild);
    secao.remove();
  }
  const filhos = Array.from(container.children) as HTMLElement[];

  const unidades: Unidade[] = [];
  filhos.forEach((no) => {
    if ((no.tagName === "OL" || no.tagName === "UL") && no.children.length > 1) {
      const tag = no.tagName as "OL" | "UL";
      const numeroBase = tag === "OL" ? (parseInt(no.getAttribute("start") ?? "", 10) || 1) : null;
      (Array.from(no.children) as HTMLElement[]).forEach((li, i) => {
        unidades.push({ li, tag, classe: no.className, numero: numeroBase !== null ? numeroBase + i : null });
      });
      no.remove();
    } else {
      unidades.push({ no });
    }
  });

  const sonda = document.createElement("div");
  sonda.className = "folha";
  container.appendChild(sonda);
  const sondaRect = sonda.getBoundingClientRect();
  const sondaCs = getComputedStyle(sonda);
  const folhaLargura = sondaRect.width;
  const folhaAltura = folhaLargura * 297 / 210;
  const padEsq = parseFloat(sondaCs.paddingLeft) || 0;
  const padDir = parseFloat(sondaCs.paddingRight) || 0;
  const padTopo = parseFloat(sondaCs.paddingTop) || 0;
  const padBase = parseFloat(sondaCs.paddingBottom) || 0;
  const alturaUtil = folhaAltura - padTopo - padBase;
  sonda.remove();

  const medidor = document.createElement("div");
  medidor.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;top:-99999px;left:-99999px;" +
    "width:" + (folhaLargura - padEsq - padDir) + "px;";
  container.appendChild(medidor);

  function alturaDoNo(no: HTMLElement): number {
    medidor.appendChild(no);
    const cs = getComputedStyle(no);
    return no.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  }
  /* mede o <li> dentro de um <ol>/<ul> descartável (só assim ele ganha o
     marcador e o padding certos) e devolve o <li> solto em seguida */
  function alturaDoLi(u: Extract<Unidade, { li: HTMLElement }>): number {
    const wrapper = document.createElement(u.tag);
    if (u.classe) wrapper.className = u.classe;
    wrapper.appendChild(u.li);
    medidor.appendChild(wrapper);
    const cs = getComputedStyle(wrapper);
    const altura = wrapper.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    medidor.appendChild(u.li);
    wrapper.remove();
    return altura;
  }
  const alturaDaUnidade = (u: Unidade) => (u.li ? alturaDoLi(u) : alturaDoNo(u.no));

  /* prioriza quebrar em fronteira de seção, mas NUNCA deixa passar do limite
     da folha mesmo no meio de uma cláusula: texto cortado (invisível, por
     causa do overflow:hidden) é bem pior do que uma cláusula atravessar a
     virada de página */
  const folhas: Unidade[][] = [];
  let atual: Unidade[] = [];
  let alturaAtual = 0;
  unidades.forEach((u) => {
    const altura = alturaDaUnidade(u);
    if (atual.length && alturaAtual + altura > alturaUtil) {
      folhas.push(atual);
      atual = []; alturaAtual = 0;
    }
    atual.push(u);
    alturaAtual += altura;
  });
  if (atual.length) folhas.push(atual);
  medidor.remove();

  /* reconstrói cada folha: unidades "li" seguidas da MESMA lista original
     viram um <ol>/<ul> novo, com "start" ajustado pra numeração continuar
     certa quando a lista atravessa a virada de página */
  function montarConteudoFolha(folha: HTMLElement, grupo: Unidade[]) {
    let i = 0;
    while (i < grupo.length) {
      const u = grupo[i];
      if (u.no) { folha.appendChild(u.no); i++; continue; }
      const lista = document.createElement(u.tag);
      if (u.classe) lista.className = u.classe;
      if (u.tag === "OL" && u.numero !== null) lista.setAttribute("start", String(u.numero));
      const tagAtual = u.tag, classeAtual = u.classe;
      while (i < grupo.length) {
        const g = grupo[i];
        if (!g.li || g.tag !== tagAtual || g.classe !== classeAtual) break;
        lista.appendChild(g.li);
        i++;
      }
      folha.appendChild(lista);
    }
  }

  const frag = document.createDocumentFragment();
  folhas.forEach((grupo, i) => {
    const folha = document.createElement("div");
    folha.className = "folha";
    montarConteudoFolha(folha, grupo);
    const numero = document.createElement("span");
    numero.className = "pagina-numero";
    numero.textContent = (i + 1) + " / " + folhas.length;
    folha.appendChild(numero);
    frag.appendChild(folha);
  });
  container.appendChild(frag);
}

/** Espera as imagens do documento (logo, assinatura) antes de medir altura. */
export function esperarImagens(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll("img"));
  return Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => undefined))))
    .then(() => undefined);
}

/* ---------- assinatura em cursiva ----------
   Renderiza o nome num canvas, pra virar PNG igual ao formato da assinatura
   desenhada (mesmo "shape" de dado que o servidor recebe). `fontFamily` é a
   família da fonte cursiva já carregada via next/font. */
export async function cursivaParaDataUrl(nome: string, fontFamily: string): Promise<string> {
  const fonte = "600 64px " + fontFamily;
  try { await document.fonts.load(fonte, nome); } catch { /* segue com a fallback */ }
  const canvas = document.createElement("canvas");
  canvas.width = 600; canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.font = fonte;
  ctx.fillStyle = "#1D1D1B";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  /* maxWidth: nome comprido encolhe em vez de vazar pela borda do PNG */
  ctx.fillText(nome, canvas.width / 2, canvas.height / 2, canvas.width - 40);
  return canvas.toDataURL("image/png");
}

/* ---------- download da via em PDF (base64 vindo da API) ---------- */
export function baixarPdfBase64(base64: string, nomeArquivo: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
