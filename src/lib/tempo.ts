/*
  Previsão do tempo detalhada (página /painel/tempo). Portada do bloco
  carregarTempo / renderTempo do estudio.html do Jordan Santos.

  Aqui mora SÓ o que é novo em relação ao clima da home: previsão por hora, por
  dia e as fases de luz (o ouro do fotógrafo). O tipo `Localizacao`, o
  `climaInfo` (emoji + descrição do código da Open-Meteo) e o `buscarClima` do
  "agora" continuam em lib/painel.ts e são reaproveitados daqui.

  Todo o cálculo devolve dado pronto pra tela: a página só desenha. Isso mantém
  a regra do projeto de escrever estado em callback, nunca no corpo do efeito.
*/
import { climaInfo, type Localizacao } from "@/lib/painel";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* Golden hour ≈ 1h depois do nascer e antes do pôr; blue hour ≈ 40min antes do
   nascer e depois do pôr. Aproximação boa o bastante pra planejar ensaio. */
const BLUE_MIN = 40;
const GOLD_MIN = 60;

/* cor fixa por ponta: mín sempre um azul sutil, máx sempre um vermelho sutil.
   Não depende do valor, só de qual das duas pontas é (o contraste entre elas já
   entrega "mais frio / mais quente"). Mesmas cores da saudação da home. */
export const COR_MIN = "#5B87B3";
export const COR_MAX = "#C15C39";

/* ---------- o que a tela recebe ---------- */

export type Agora = {
  emoji: string;
  desc: string;
  temp: number;
  sensacao: number;
  umidade: number;
  vento: number;
  min: number | null;
  max: number | null;
};

export type Hora = { chave: string; rotulo: string; emoji: string; temp: number };

export type Dia = { chave: string; nome: string; emoji: string; chuva: number | null; min: number; max: number };

export type Fase = "blue" | "golden" | "dia";
export type Segmento = { chave: string; fase: Fase; largura: number };
export type Marca = { emoji: string; hora: string; pct: number };
/** Uma das duas janelas de golden hour, com a condição prevista pra ela. */
export type Janela = { rotulo: string; desc: string; chuva: number; escolhida: boolean };
/** Faixa de horário: início e fim, desenhados com seta (nunca travessão). */
export type Faixa = { ini: string; fim: string };

export type Luz = {
  segmentos: Segmento[];
  marcas: Marca[];
  /** posição do "agora" na barra; null quando é madrugada (fora da faixa) */
  agoraPct: number | null;
  melhorRotulo: string;
  melhorFaixa: Faixa;
  manha: Janela;
  tarde: Janela;
  golden: [Faixa, Faixa];
  blue: [Faixa, Faixa];
  uv: number | null;
  uvTexto: string;
};

/** Nome do lugar em dois pesos: cidade pesada, estado/país leve. */
export type Local = { forte: string; leve: string };

export type Previsao = {
  local: Local | null;
  agora: Agora;
  luz: Luz | null;
  horas: Hora[];
  dias: Dia[];
};

/** Três finais possíveis: sem cidade salva, falha na busca, previsão pronta. */
export type EstadoTempo = { tipo: "vazio" } | { tipo: "erro" } | { tipo: "ok"; previsao: Previsao };

/* ---------- resposta crua da Open-Meteo ---------- */

type RespostaPrevisao = {
  current?: {
    temperature_2m: number;
    weather_code: number;
    is_day: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    is_day?: number[];
    precipitation_probability?: (number | null)[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max?: (number | null)[];
    sunrise?: string[];
    sunset?: string[];
    uv_index_max?: (number | null)[];
  };
};

/* ---------- busca ---------- */

/** Previsão de 7 dias na Open-Meteo (grátis, sem chave). */
export async function carregarPrevisao(loc: Localizacao | null | undefined): Promise<EstadoTempo> {
  if (!loc || !isFinite(Number(loc.lat)) || !isFinite(Number(loc.lon))) return { tipo: "vazio" };
  try {
    const u =
      "https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat + "&longitude=" + loc.lon +
      "&current=temperature_2m,weather_code,is_day,apparent_temperature,relative_humidity_2m,wind_speed_10m" +
      "&hourly=temperature_2m,weather_code,is_day,precipitation_probability" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max" +
      "&timezone=auto&forecast_days=7";
    const r = await fetch(u);
    if (!r.ok) return { tipo: "erro" };
    const d = (await r.json()) as RespostaPrevisao;
    if (!d.current) return { tipo: "erro" };
    return { tipo: "ok", previsao: montar(d, loc) };
  } catch {
    return { tipo: "erro" };
  }
}

/* ---------- montagem ---------- */

function montar(d: RespostaPrevisao, loc: Localizacao): Previsao {
  return {
    local: partirLocal(loc.nome || loc.cidade || ""),
    agora: montarAgora(d),
    luz: montarLuz(d),
    horas: montarHoras(d),
    dias: montarDias(d),
  };
}

/** "Curitiba, Paraná, Brasil" → cidade forte, resto leve. */
function partirLocal(texto: string): Local | null {
  const t = texto.trim();
  if (!t) return null;
  const virgula = t.indexOf(",");
  return virgula === -1
    ? { forte: t, leve: "" }
    : { forte: t.slice(0, virgula + 1), leve: t.slice(virgula + 1) };
}

function montarAgora(d: RespostaPrevisao): Agora {
  const cur = d.current!;
  const info = climaInfo(cur.weather_code, cur.is_day === 1);
  return {
    emoji: info.emoji,
    desc: info.desc,
    temp: Math.round(cur.temperature_2m),
    sensacao: Math.round(cur.apparent_temperature),
    umidade: Math.round(cur.relative_humidity_2m),
    vento: Math.round(cur.wind_speed_10m),
    max: d.daily?.temperature_2m_max?.[0] != null ? Math.round(d.daily.temperature_2m_max[0]) : null,
    min: d.daily?.temperature_2m_min?.[0] != null ? Math.round(d.daily.temperature_2m_min[0]) : null,
  };
}

/** Próximas ~12 horas, a partir da hora atual. A primeira vira "Agora". */
function montarHoras(d: RespostaPrevisao): Hora[] {
  const h = d.hourly;
  if (!h?.time?.length) return [];
  const agoraMs = Date.now();
  let ini = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= agoraMs - 3600000) { ini = i; break; }
  }
  const fim = Math.min(ini + 12, h.time.length);
  const lista: Hora[] = [];
  for (let j = ini; j < fim; j++) {
    const quando = new Date(h.time[j]);
    const info = climaInfo(h.weather_code[j], h.is_day ? h.is_day[j] === 1 : true);
    lista.push({
      chave: h.time[j],
      rotulo: j === ini ? "Agora" : quando.getHours() + "h",
      emoji: info.emoji,
      temp: Math.round(h.temperature_2m[j]),
    });
  }
  return lista;
}

function montarDias(d: RespostaPrevisao): Dia[] {
  const dia = d.daily;
  if (!dia?.time?.length) return [];
  return dia.time.map((iso, k) => {
    /* T12:00 (meio-dia local) e não a meia-noite: em fuso negativo a data crua
       cai no dia anterior e o nome do dia da semana sai errado. */
    const quando = new Date(iso + "T12:00");
    const info = climaInfo(dia.weather_code[k], true);
    const chuva = dia.precipitation_probability_max?.[k];
    return {
      chave: iso,
      nome: k === 0 ? "Hoje" : DIAS_SEMANA[quando.getDay()],
      emoji: info.emoji,
      chuva: chuva == null ? null : chuva,
      min: Math.round(dia.temperature_2m_min[k]),
      max: Math.round(dia.temperature_2m_max[k]),
    };
  });
}

/* ---------- luz do dia ---------- */

function hhmm(dt: Date): string {
  return ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2);
}

function somarMin(dt: Date, min: number): Date {
  return new Date(dt.getTime() + min * 60000);
}

/** Chance de chuva e código do céu na primeira hora prevista a partir de `dt`. */
function avaliarHora(d: RespostaPrevisao, dt: Date): { chuva: number; codigo: number } {
  const h = d.hourly;
  if (!h?.time?.length) return { chuva: 0, codigo: 0 };
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= dt.getTime()) {
      return { chuva: h.precipitation_probability?.[i] ?? 0, codigo: h.weather_code[i] };
    }
  }
  return { chuva: 0, codigo: 0 };
}

function textoUv(uv: number): string {
  if (uv <= 2) return "baixo";
  if (uv <= 5) return "moderado";
  if (uv <= 7) return "alto";
  if (uv <= 10) return "muito alto";
  return "extremo";
}

/** Timeline do dia: blue → golden → dia → golden → blue, com nascer, pôr,
 *  "agora" e a melhor das duas golden hours (menos chuva; empate: céu mais
 *  limpo). null quando a API não trouxe nascer/pôr do sol. */
function montarLuz(d: RespostaPrevisao): Luz | null {
  const dia = d.daily;
  if (!dia?.sunrise?.[0] || !dia?.sunset?.[0]) return null;

  const nasce = new Date(dia.sunrise[0]);
  const poe = new Date(dia.sunset[0]);
  const spanIni = somarMin(nasce, -BLUE_MIN).getTime();
  const spanFim = somarMin(poe, BLUE_MIN).getTime();
  const total = spanFim - spanIni;
  if (!(total > 0)) return null;

  const pct = (dt: Date) => Math.max(0, Math.min(100, ((dt.getTime() - spanIni) / total) * 100));
  const larg = (a: Date, b: Date) => ((b.getTime() - a.getTime()) / total) * 100;

  const gmIni = nasce, gmFim = somarMin(nasce, GOLD_MIN);
  const gtIni = somarMin(poe, -GOLD_MIN), gtFim = poe;

  const segmentos: Segmento[] = [
    { chave: "blue-manha", fase: "blue", largura: larg(somarMin(nasce, -BLUE_MIN), nasce) },
    { chave: "golden-manha", fase: "golden", largura: larg(gmIni, gmFim) },
    { chave: "dia", fase: "dia", largura: larg(gmFim, gtIni) },
    { chave: "golden-tarde", fase: "golden", largura: larg(gtIni, gtFim) },
    { chave: "blue-tarde", fase: "blue", largura: larg(poe, somarMin(poe, BLUE_MIN)) },
  ];

  const marcas: Marca[] = [
    { emoji: "🌅", hora: hhmm(nasce), pct: pct(nasce) },
    { emoji: "🌇", hora: hhmm(poe), pct: pct(poe) },
  ];

  const agoraMs = Date.now();
  const agoraPct = agoraMs >= spanIni && agoraMs <= spanFim ? pct(new Date(agoraMs)) : null;

  const am = avaliarHora(d, gmIni);
  const at = avaliarHora(d, gtIni);
  const tardeMelhor = at.chuva < am.chuva || (at.chuva === am.chuva && at.codigo <= am.codigo);

  const manha: Janela = {
    rotulo: "Manhã",
    desc: climaInfo(am.codigo, true).desc,
    chuva: am.chuva,
    escolhida: !tardeMelhor,
  };
  const tarde: Janela = {
    rotulo: "Tarde",
    desc: climaInfo(at.codigo, true).desc,
    chuva: at.chuva,
    escolhida: tardeMelhor,
  };

  const uvBruto = dia.uv_index_max?.[0];
  const uv = uvBruto == null ? null : Math.round(uvBruto);

  return {
    segmentos,
    marcas,
    agoraPct,
    melhorRotulo: tardeMelhor ? "Fim de tarde" : "De manhã",
    melhorFaixa: tardeMelhor ? { ini: hhmm(gtIni), fim: hhmm(gtFim) } : { ini: hhmm(gmIni), fim: hhmm(gmFim) },
    manha,
    tarde,
    golden: [
      { ini: hhmm(gmIni), fim: hhmm(gmFim) },
      { ini: hhmm(gtIni), fim: hhmm(gtFim) },
    ],
    blue: [
      { ini: hhmm(somarMin(nasce, -BLUE_MIN)), fim: hhmm(nasce) },
      { ini: hhmm(poe), fim: hhmm(somarMin(poe, BLUE_MIN)) },
    ],
    uv,
    uvTexto: uv == null ? "" : textoUv(uv),
  };
}

/* ---------- resumos dos cabeçalhos de seção ---------- */

/** "12 horas · 14° a 23°" (ou "" quando não há o que resumir). */
export function resumoHoras(horas: Hora[]): string {
  if (!horas.length) return "";
  const temps = horas.map((h) => h.temp);
  return horas.length + " horas · " + Math.min(...temps) + "° a " + Math.max(...temps) + "°";
}

/** "7 dias · 12° a 28°" */
export function resumoDias(dias: Dia[]): string {
  if (!dias.length) return "";
  const min = Math.min(...dias.map((d) => d.min));
  const max = Math.max(...dias.map((d) => d.max));
  return dias.length + " dias · " + min + "° a " + max + "°";
}
