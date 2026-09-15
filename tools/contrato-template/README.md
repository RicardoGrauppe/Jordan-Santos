# Gerador dos templates PDF do contrato

Ferramenta **local**. Nunca roda em produção: o Next só empacota o que enxerga a partir das rotas, e `tools/` não é importado por nenhuma. Roda na máquina de quem edita o texto do contrato.

## Pra que serve

O PDF do contrato assinado **não** é mais um screenshot da tela. Ele é montado assim:

1. **Aqui** (uma vez, offline): o `src/lib/contrato-template.ts`, a fonte única do texto do contrato, é paginado em folhas A4 e impresso pelo Chrome como **PDF vetorial**, com os campos variáveis virando lacunas em branco. Junto sai um mapa (`coords.json`) com a posição exata de cada lacuna.
2. **Na assinatura**: `src/lib/contrato-pdf/gerar.js` abre esse template com `pdf-lib` e escreve os valores do casal nas lacunas, desenha a tabela de itens e carimba as duas assinaturas.

Ou seja: o Chrome roda **aqui**, não na Vercel. É o que evita ter que empacotar um Chromium de ~50 MB na serverless function.

## Quando regerar

**Sempre que mexer no texto do contrato** (`src/lib/contrato-template.ts`): cláusula nova, redação alterada, campo novo.

Se não regerar, a tela de revisão (`/assinar` e `/painel/clientes/<id>/contrato`) mostra o texto novo enquanto o PDF arquivado continua com o velho — em silêncio. Pra isso existe a checagem:

```bash
npm run contrato:verificar
```

Ela compara o SHA-256 do `src/lib/contrato-template.ts` com o que ficou carimbado em `coords.json` no dia da geração e avisa se divergiram.

## Como regerar

Precisa de **Google Chrome** instalado e Node. Da raiz do repositório:

```bash
node --experimental-websocket tools/contrato-template/rodar.mjs
```

Isso sobrescreve, em `src/lib/contrato-pdf/`, os dois arquivos: `template.pdf` e `coords.json`.

Depois, **confira um PDF preenchido de verdade antes de commitar** — assine um contrato de teste no `/assinar` local (banco em Docker) e abra o arquivo.

## Este caminho é LEGADO

Todo contrato gerado hoje carrega o snapshot de um modelo (o que o fotógrafo
edita em Configurações) e sai pelo `gerar-pdfmake.js`, que monta o PDF do zero
e não toca em template nenhum. O `gerar.js` com este `template.pdf` só entra em
contrato **sem** modelo, ou seja, contrato antigo, de antes dos modelos
existirem. Continua aqui pra esses poderem ser reimpressos.

Houve uma época de três variantes (`template-{P,M,G}.pdf`, escolhidas pela
quantidade de itens do casal). Não existem mais: é um template só.

## O que mudou do estúdio original pra cá

Lá o texto do contrato era um `.js` solto que o `gerador.html` carregava com
`<script src>`. Aqui a fonte é TypeScript (`src/lib/contrato-template.ts`),
então o `rodar.mjs` compila com o `tsc` do projeto e **costura** o JavaScript
dentro de uma cópia do `gerador.html` (`.gerador-compilado.html`, ignorada pelo
git). A cópia fica na mesma pasta do original de propósito: os caminhos
relativos das fontes e da logo continuam valendo.

Prova de que a tradução não mexeu na geometria: regerado aqui, o `coords.json`
saiu **idêntico** ao do estúdio original em todas as coordenadas. Só o carimbo
`geradoDe` mudou, porque agora aponta pro arquivo `.ts`.

## Detalhes que parecem bobos mas não são

Todos estes já causaram texto caindo fora da lacuna. Se mexer no gerador, não desfaça sem entender:

- **Espera `document.fonts.load()` de cada fonte ANTES de paginar.** Só `document.fonts.ready` não serve: quando ele é chamado, o documento ainda está vazio (o `#fonte` é `display:none`), então resolve na hora, sem nada pendente — e a paginação acontecia com a métrica da fonte de fallback, mudando de uma execução pra outra. Como a impressão espera as fontes de verdade, o mapa descrevia um layout que não era o do PDF. **Teste que pega isso:** rodar duas vezes seguidas e comparar os `coords.json` — têm que sair idênticos.
- **As fontes são locais** (`fonts/`), não do Google Fonts — carregamento determinístico, sem depender da rede.
- **Uma sessão só do Chrome**, via DevTools Protocol. Rodar `--dump-dom` e `--print-to-pdf` como dois comandos separados pegava estados diferentes da paginação.
- **Cada lacuna tem um `&nbsp;` dentro.** Um `inline-block` vazio não tem baseline de texto — o navegador usa a borda de baixo da caixa —, e a lacuna afundava em relação ao texto vizinho.
- **A altura medida sai da caixa do TEXTO (via `Range`), não do `inline-block`.** A caixa do elemento desliza pra cima ou pra baixo conforme seja maior ou menor que a `line-height` da linha.
- **As coordenadas são relativas ao `.conteudo-pag`**, não à `.pagina-a4`, e o `gerar.js` soma as margens de volta (`margemTopoMm`/`margemEsquerdaMm` vão no JSON).
- **A logo tem altura fixa no CSS** (`67.16px`, a proporção real do arquivo). Sem isso, medir antes de a imagem carregar deslocava todos os campos.
- **Lacuna nova precisa de largura em `LARGURAS`.** O que não estiver lá cai no padrão de 140px, mesmo que o HTML diga outra coisa.
