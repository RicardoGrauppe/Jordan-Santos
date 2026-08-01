# Gerador dos templates PDF do contrato

Ferramenta **local**. Não vai pro ar (o `.vercelignore` exclui `tools/`) e nunca roda em produção — só na máquina de quem edita o contrato.

## Pra que serve

O PDF do contrato assinado **não** é mais um screenshot da tela. Ele é montado assim:

1. **Aqui** (uma vez, offline): o `contrato-template.js` — a fonte única do texto do contrato — é paginado em folhas A4 e impresso pelo Chrome como **PDF vetorial**, com os campos variáveis virando lacunas em branco. Junto sai um mapa (`coords-*.json`) com a posição exata de cada lacuna.
2. **Em produção** (a cada assinatura): `api/_lib/contrato-pdf/gerar.js` abre esse template com `pdf-lib` e escreve os valores do casal nas lacunas, desenha a tabela de itens e carimba as duas assinaturas.

Ou seja: o Chrome roda **aqui**, não na Vercel. É o que evita ter que empacotar um Chromium de ~50 MB na serverless function.

## Quando regerar

**Sempre que mexer no texto do contrato** (`contrato-template.js`): cláusula nova, redação alterada, campo novo.

Se não regerar, a tela de revisão (`/assinar`, `/revisar-contrato`) mostra o texto novo enquanto o PDF arquivado continua com o velho — em silêncio. Pra isso existe a checagem:

```bash
npm run contrato:verificar
```

Ela compara o SHA-256 do `contrato-template.js` com o que ficou carimbado em `coords-*.json` no dia da geração e avisa se divergiram.

## Como regerar

Precisa de **Google Chrome** instalado e Node. Da raiz do repositório:

```bash
node --experimental-websocket tools/contrato-template/rodar.mjs
```

Isso sobrescreve, em `api/_lib/contrato-pdf/`, os seis arquivos: `template-{P,M,G}.pdf` e `coords-{P,M,G}.json`. Pra regerar só uma variante: `... rodar.mjs M`.

Depois, **confira um PDF preenchido de verdade antes de commitar** — assine um contrato de teste no `/assinar` local e abra o arquivo.

## As três variantes

A tabela de itens tem tamanho variável (o casal pode ter de 1 a 9 itens do catálogo), e a caixa reservada pra ela é um bloco atômico: se não couber no que sobrou da página, pula inteira pra próxima. Reservar sempre o pior caso deixava um vão enorme na página 1 dos contratos pequenos.

Daí três templates, escolhidos pela quantidade real de itens (o `gerar.js` faz isso sozinho):

| Variante | Itens | Altura reservada |
|---|---|---|
| `P` | até 3 | 170 px |
| `M` | 4 a 6 | 260 px |
| `G` | 7 a 9 | 360 px |

## Detalhes que parecem bobos mas não são

Todos estes já causaram texto caindo fora da lacuna. Se mexer no gerador, não desfaça sem entender:

- **Espera `document.fonts.load()` de cada fonte ANTES de paginar.** Só `document.fonts.ready` não serve: quando ele é chamado, o documento ainda está vazio (o `#fonte` é `display:none`), então resolve na hora, sem nada pendente — e a paginação acontecia com a métrica da fonte de fallback, mudando de uma execução pra outra. Como a impressão espera as fontes de verdade, o mapa descrevia um layout que não era o do PDF. **Teste que pega isso:** rodar duas vezes seguidas e comparar os `coords-*.json` — têm que sair idênticos.
- **As fontes são locais** (`fonts/`), não do Google Fonts — carregamento determinístico, sem depender da rede.
- **Uma sessão só do Chrome**, via DevTools Protocol. Rodar `--dump-dom` e `--print-to-pdf` como dois comandos separados pegava estados diferentes da paginação.
- **Cada lacuna tem um `&nbsp;` dentro.** Um `inline-block` vazio não tem baseline de texto — o navegador usa a borda de baixo da caixa —, e a lacuna afundava em relação ao texto vizinho.
- **A altura medida sai da caixa do TEXTO (via `Range`), não do `inline-block`.** A caixa do elemento desliza pra cima ou pra baixo conforme seja maior ou menor que a `line-height` da linha.
- **As coordenadas são relativas ao `.conteudo-pag`**, não à `.pagina-a4`, e o `gerar.js` soma as margens de volta (`margemTopoMm`/`margemEsquerdaMm` vão no JSON).
- **A logo tem altura fixa no CSS** (`67.16px`, a proporção real do arquivo). Sem isso, medir antes de a imagem carregar deslocava todos os campos.
- **Lacuna nova precisa de largura em `LARGURAS`.** O que não estiver lá cai no padrão de 140px, mesmo que o HTML diga outra coisa.
