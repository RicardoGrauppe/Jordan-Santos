# Design do Portfólio (index.html)

Mapa da identidade visual usada na página pública de portfólio. Só o `/` (index.html), não vale pra estúdio/cadastro/assinar/revisar (esses são áreas de app, seguem outro sistema mais próximo do padrão iOS/dashboard).

Marca oficial do Diogo (2026-07). Fonte da verdade: `Assets/Marca/` do cliente. Qualquer peça que sair do site (impressos, e-mail, redes) respeita esta paleta e tipografia.

---

## Paleta

Definida em `:root` no topo do `<style>`.

| Token          | Hex        | Uso                                                |
| -------------- | ---------- | -------------------------------------------------- |
| `--paper`      | `#FFFFFF`  | Fundo principal                                     |
| `--ink`        | `#1D1D1B`  | Corpo de texto, preto oficial da marca             |
| `--ink-soft`   | `#706F6F`  | Legenda, sublinha, parcela                          |
| `--accent`     | `#003646`  | Azul petróleo, títulos e destaques                 |
| `--accent-deep`| `#4F6278`  | Azul aço, usado só em preços                        |
| `--noir`       | `#1D1D1B`  | Capa, rodapé, seção de citação                     |
| `--line`       | `#E8E1DC`  | Off-white da marca, bordas de card e da pílula     |
| `--sombra`     | `0 10px 34px rgba(29,29,27,.14)` | Sombra padrão de card |

Regras:
- Ícone/preço em `--accent-deep`, nunca em `--accent`.
- Card branco sempre com `border 1px solid --line` + sombra sutil (não usa sombra pesada nesta página, prefere linha).
- Fundo escuro (capa/citação/rodapé) é `--noir`, com texto em `#fff` e cinza `#8f8f8f` / `#D8D4CE` pros hints.

## Tipografia

Fontes carregadas do Google Fonts na `<head>`.

- `--serif`: **Bodoni Moda** (fallback Didot, Georgia, serif). Aproximação até o Diogo nomear as fontes oficiais.
  - Pesos: 400, 500, 600 (com opsz variável 6..96).
  - Uso: h2, títulos de card (h3), preços, citação, wordmark.
- `--sans`: **Jost** (fallback Helvetica Neue, sans-serif). Pesos 300, 400, 500.
  - Body: `font-weight:300`, `font-size:16px`, `line-height:1.65`.
  - Padrão do corpo do site.

Escalas específicas:
- `h2`: `clamp(30px, 5.4vw, 44px)`, peso 500, `letter-spacing:.14em`, uppercase.
- `.card h3`: 30px, peso 500, `.1em`, uppercase.
- `.preco`: 27px, peso 600, cor `--accent-deep`.
- `.dica` (pílula de seção): 11px, `.22em`, uppercase, `--accent`.
- `.entrega-texto p`: 12.5px, `.14em`, uppercase, `line-height:2.1`.
- `.capa-hint`: 11px, `.28em`, uppercase, cor `#8f8f8f`.
- Citação: `clamp(21px, 3.4vw, 29px)`, serif 400, cor branca com `text-shadow`.

## Ritmo e layout

- `.pagina{padding:104px 24px}` é o bloco base. Toda seção começa e termina com 104px de respiro vertical.
- `.miolo{max-width:680px;margin:0 auto}` — colunas de texto e cards centrados.
- `.miolo-largo{max-width:780px}` — variação pra seções que respiram mais.
- `.foto-full`, `.foto-meia` (`height:64vh` cover) e `.foto-banner` (`height:34vh`, sangra pra fora do padding lateral) são as três variações de foto de página cheia.
- Gap entre cards no mesmo bloco: `.card-centro + .card-centro{margin-top:26px}`.
- No mobile (`<900px`), `#adicionais` e `#prewedding` mudam a arquitetura: o texto vira bloco na cor do céu da foto e a foto sobe por trás com máscara linear, sem gap morto.

## Componentes-chave

### `.dica`

Pílula uppercase que abre cada seção. Borda `--line`, texto `--accent`, `border-radius:999px`, `padding:6px 14px`, `margin-bottom:28px`.

### `.card`

Card base branco com `border-radius:14px`, borda 1px `--line`, sombra suave `0 4px 18px rgba(29,29,27,.06)`, padding `36px 40px`. Variantes:
- `.pacote-eternal`: alinhado à esquerda, max-width 460.
- `.pacote-heritage`: alinhado à direita, `margin-top:56px`.
- `.card-centro`: centralizado, `max-width:480px`.

### `.linha` (adicionais)

Item de lista sobre foto: `background:rgba(255,255,255,.32)`, `padding:11px 14px`, `border-radius:10px`. Nome à esquerda (`flex:1`), valor à direita (serif 19px, `--accent-deep`, `white-space:nowrap`). Legenda embaixo do nome em 12.5px, `--ink-soft`.

### `.swoosh`

SVG decorativo em `position:absolute` cobrindo o container, com `pointer-events:none`. `stroke: --line`, `stroke-width:1.2`, sem fill. Usado nas seções de pacote pra dar movimento sem interferir no clique.

### `.cta` (WhatsApp)

Botão pill: `padding:19px 40px`, `border-radius:999px`, `font-size:13px`, `letter-spacing:.22em`, uppercase. Ícone SVG 19×19, `gap:10px`. Variante `.cta-whats`: `background:#25D366`, texto branco. Hover: `opacity:.85`. Sem anel de foco (regra do vault).

### Capa e rodapé (`.capa`, `.fim`)

Ambos em `--noir` cheio de altura. Capa é `min-height:100vh`, flex column centrado com wordmark ~440px e uma `capa-hint` com underline animado descendo (2.4s loop, respeita `prefers-reduced-motion`). Rodapé com wordmark 270px, links em branco (hover `--accent`), ano em cinza 11px `.2em`.

### Citação (`.quote-full`)

Foto full-bleed com `opacity:.88` sobre `--noir`, blockquote em `position:absolute` no canto superior esquerdo (`top:9%; left:6%`), max-width 520px, serif 400, texto branco com `text-shadow:0 1px 18px rgba(0,0,0,.45)`.

## Animação

- `.reveal` entra com `opacity:0` + `translateY(26px)` e vai pra `.in` (700ms ease). Disparo via IntersectionObserver no fim do arquivo.
- `.capa-hint::after`: barra vertical descendente, `2.4s ease-in-out infinite`.
- Ambas respeitam `@media (prefers-reduced-motion: reduce)`: transições zeradas, animação desligada, `scroll-behavior:auto`.

## O que esta página NÃO faz

- Não tem seleção de pacote. Cards são `<div>` estáticos, sem estado. Escolha de pacote/adicional acontece no `/estudio` (Jordan mesmo).
- Não tem grade de Instagram. A seção `#portfolio` foi removida em 2026-08-01. Instagram fica só no link do rodapé.
- Não expõe link pro `/cadastro` nem pro contrato. Ambos são mandados pelo Jordan por WhatsApp depois de conversa inicial.
- Não usa focus ring em nenhum lugar (regra do vault).
