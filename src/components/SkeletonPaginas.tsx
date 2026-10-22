/*
  Esqueletos de PÁGINA inteira, mostrados pelo `loading.tsx` de cada rota no
  instante do toque (22/10/2026, pedido do Ricardo: "caso a internet esteja
  lenta, ao clicar já deve carregar um skeleton"). Sem eles, num 4G fraco a
  tela antiga ficava parada até a nova chegar, e parecia que o toque não
  tinha pegado (e a pessoa tocava de novo).

  Cada um tem o desenho e a largura da página de verdade, pra a troca de
  esqueleto por conteúdo não pular. Server components: nada aqui precisa de JS.
*/
import { BannerPainel } from "@/components/BannerPainel";
import { Sk, SkCartaoModelo, SkCartaoNovo, SkCirculo, SkLinha } from "@/components/Skeleton";

/* linhas claras sobre o petróleo do banner (o Sk é cinza e sumiria) */
function LinhaBanner({ className = "" }: { className?: string }) {
  return <span aria-hidden className={"block rounded-full bg-white/15 " + className} />;
}

function SkBanner({ numeros = 0 }: { numeros?: number }) {
  return (
    <BannerPainel className="mb-[18px]">
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
        <div className="min-w-0 flex-1">
          <LinhaBanner className="hidden h-8 w-40 md:block" />
          <LinhaBanner className="mt-3 h-3.5 w-[85%] max-w-[420px]" />
          <LinhaBanner className="mt-2 h-3.5 w-[60%] max-w-[300px]" />
          <LinhaBanner className="mt-5 hidden h-10 w-36 rounded-xl md:block" />
        </div>
        {numeros ? (
          <div className="grid grid-cols-3 gap-2 md:w-[500px] md:shrink-0 md:gap-2.5">
            {Array.from({ length: numeros }, (_, i) => (
              <div key={i} className="rounded-[14px] bg-white/[.09] px-3 py-3">
                <LinhaBanner className="h-2.5 w-14" />
                <LinhaBanner className="mt-2 h-5 w-10" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </BannerPainel>
  );
}

export function SkPaginaHome() {
  return (
    <div className="mx-auto max-w-[960px]" aria-busy="true" aria-label="Carregando">
      <div className="mb-6 flex items-center gap-4">
        <Sk className="h-11 w-11 rounded-[14px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <Sk className="h-[22px] w-[min(62%,340px)] rounded-[9px]" />
          <Sk className="h-[13px] w-[min(48%,220px)] rounded-[7px]" />
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-line shadow-card md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-paper px-[22px] py-5">
            <Sk className="h-[30px] w-[54px] rounded-[9px]" />
            <SkLinha className="mt-3 w-[72%]" />
          </div>
        ))}
      </div>
      {[0, 1].map((s) => (
        <section key={s} className="mb-4 rounded-[22px] bg-paper p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2.5">
            <Sk className="h-9 w-9 rounded-[13px]" />
            <SkLinha className="w-[140px]" />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="mb-2 flex items-center gap-3.5 rounded-[14px] bg-[#F7F9FA] px-3.5 py-3">
              <SkCirculo />
              <SkLinha className="w-[55%]" />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export function SkPaginaClientes() {
  return (
    <div className="mx-auto max-w-[1100px]" aria-busy="true" aria-label="Carregando">
      <SkBanner numeros={3} />
      <div className="mb-[18px] flex gap-2">
        {[96, 56, 92, 84].map((w, i) => <Sk key={i} className="h-8 rounded-full" style={{ width: w }} />)}
      </div>
      <div className="flex flex-col gap-2.5 md:gap-0 md:overflow-hidden md:rounded-[22px] md:bg-paper">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-[18px] bg-paper px-4 py-[18px] md:rounded-none md:px-[18px]">
            <SkCirculo className="h-8 w-8" />
            <SkLinha className="w-[40%]" />
            <SkLinha className="ml-auto hidden w-[90px] md:block" />
            <SkLinha className="hidden w-[80px] md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkPaginaFicha() {
  const bloco = "rounded-[22px] bg-paper p-5";
  return (
    <div className="mx-auto max-w-[1100px]" aria-busy="true" aria-label="Carregando">
      <SkBanner numeros={4} />
      <div className="grid grid-cols-1 items-start gap-x-5 gap-y-4 min-[1080px]:grid-cols-[minmax(0,1.42fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 min-[1080px]:order-2">
          <div className={bloco}><SkLinha className="w-[40%]" /><Sk className="mt-4 h-[72px] w-full rounded-2xl" /><Sk className="mt-4 h-11 w-full rounded-xl" /></div>
          <div className={bloco}><SkLinha className="w-[50%]" /><Sk className="mt-4 h-[64px] w-full rounded-2xl" /></div>
        </div>
        <div className="flex flex-col gap-4 min-[1080px]:order-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className={bloco}>
              <SkLinha className="w-[30%]" />
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Sk className="h-11 rounded-[10px]" /><Sk className="h-11 rounded-[10px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkPaginaAtelie() {
  return (
    <div className="mx-auto max-w-[1040px]" aria-busy="true" aria-label="Carregando">
      <SkBanner />
      {[0, 1].map((s) => (
        <div key={s} className="mt-6">
          <SkLinha className="mb-3 h-4 w-28" />
          <Sk className="mb-4 h-14 w-full rounded-[22px]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            <SkCartaoModelo />
            <SkCartaoNovo />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Páginas de lista simples (pacotes, pendências, modelos de contrato). */
export function SkPaginaLista({ largura = 900 }: { largura?: number }) {
  return (
    <div className="mx-auto" style={{ maxWidth: largura }} aria-busy="true" aria-label="Carregando">
      <Sk className="mb-5 hidden h-8 w-56 rounded-[10px] md:block" />
      <div className="rounded-[22px] bg-paper p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <SkLinha className="w-[45%]" />
            <SkLinha className="ml-auto w-[80px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Editores de tela cheia (contrato, site do Ateliê): a mesa cinza e a folha
 *  branca, sem a moldura do painel, que essas telas não têm. */
export function SkPaginaEditor() {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-soft" aria-busy="true" aria-label="Carregando">
      <div className="h-[104px] shrink-0 bg-paper shadow-card" />
      <div className="flex flex-1 justify-center overflow-hidden px-4 pt-7">
        <div className="h-full w-full max-w-[794px] rounded-t-sm bg-paper p-10 shadow-card">
          <SkLinha className="w-[50%]" />
          {[92, 88, 95, 70, 90, 84, 60].map((w, i) => <SkLinha key={i} className="mt-4" style={{ width: w + "%" }} />)}
        </div>
      </div>
    </div>
  );
}
