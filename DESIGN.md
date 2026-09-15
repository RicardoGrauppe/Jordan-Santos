# Design do painel

Mapa da identidade visual do produto. Portado de `DESIGN-ESTUDIO.md` do estúdio
do Jordan Santos, que é a origem deste app, com uma tradução: lá as decisões
moravam em classes CSS escritas à mão, aqui moram em **tokens do Tailwind 4**
(bloco `@theme` de `src/app/globals.css`) e em **componentes React**
(`src/components/ui.tsx`).

Guia complementar: `TOM-DE-VOZ.md` (voz e microcopy). Regras curtas de
convivência com o código: `CLAUDE.md`.

Quando bater dúvida do que uma tela faz, a fonte da verdade de comportamento
continua sendo o HTML equivalente no estúdio original (somente leitura).

A peça visual que originou este documento está em `docs/brandbook.html`
(`open docs/brandbook.html`): paleta, sombras e componentes renderizados. Ela
usa os nomes de classe do app antigo; a tradução pros tokens e componentes
daqui é este arquivo.

---

## Filosofia

Área de trabalho, não vitrine.

- **Sem borda pra separar ou marcar estado.** Fundo diferente (`bg-soft`) mais
  sombra (`shadow-card`) resolvem. Antes de escrever `border`, resolva com tom.
- **Sem anel de foco.** O retorno de teclado é mudança sutil de fundo, nunca
  `box-shadow` ou `outline` colorido. Está em `@layer base` no globals.css.
- **Sem travessão em texto de tela.** Vírgula, dois-pontos, parênteses.
- **Uma família tipográfica só** (Inter) dentro do painel. O par serifada mais
  sans é do que o CASAL vê (proposta, cadastro, assinar).
- **Ícones lucide-react**, `strokeWidth` padrão da biblioteca, cor herdada do
  texto ou `text-accent`. Tamanho 16 em botão, 15 em pill pequena, 17 em pill
  grande.

## Paleta

Tokens no `@theme` de `src/app/globals.css`. Use sempre a classe do token
(`bg-paper`, `text-ink-soft`), nunca o hex solto.

| Token           | Hex       | Uso                                                        |
| --------------- | --------- | ---------------------------------------------------------- |
| `paper`         | `#FFFFFF` | Fundo dos cartões elevados e do cabeçalho                   |
| `ink`           | `#1F2329` | Corpo de texto principal                                    |
| `ink-soft`      | `#6B7280` | Legenda, rótulo, texto de estado pendente                   |
| `accent`        | `#003646` | Petróleo. Ação primária, ícone em pill, hero, número de KPI |
| `accent-hover`  | `#00485C` | Hover do primário                                           |
| `accent-deep`   | `#4F6278` | Aço. Uso pontual em valor e preço                           |
| `noir`          | `#1D1D1B` | Toast                                                       |
| `line`          | `#E4E6EA` | Hover secundário e hairline interna. NUNCA como borda       |
| `soft`          | `#F6F7F9` | Fundo de campo, hover primário, chip cinza, fundo da página |
| `ok` / `ok-tint`| `#2E6B4F` / `#E7F1EC` | Sucesso, timeline assinada                      |
| `erro` / `erro-tint` | `#A33B3B` / `#FBEBEB` | Perigo (excluir, cancelar contrato)        |
| `accent-tint`   | `#EAF1F3` | Fundo das pills de ícone                                    |

Fora do `@theme`, dois tons que aparecem sempre juntos e por isso ficam escritos
onde são usados: **âmbar suave** `#FBF6E8` com ícone e texto `#7A5A11` (banner de
aviso) e **terroso** `#F8F4EE` com pill `#EBE2D3` e texto `#8A6A3C` (card de
atenção). O terroso é âmbar puxado pro taupe de propósito: âmbar forte brilhava
demais pra um card que aparece toda vez que abre a Home.

Sombras: `shadow-card` (repouso), `shadow-card-hover` (hover de card clicável),
`shadow-alta` (dropdown, modal, cartão de login).

## Tipografia

Inter, pesos 400/500/600/800.

- Corpo: 14.5px, `line-height:1.55`.
- `h1` de página: 22px, peso 600, `tracking-[-.01em]`.
- Saudação da Home: mesma h1, com o nome do estúdio em peso **800**.
- Número de KPI: 28px, peso 600, `tabular-nums`. Quando é data, 19px.
- Rótulo de KPI: 11px, uppercase, `tracking-[.08em]`, `text-ink-soft`.
- Título de seção (`Secao`): 13px, peso 600, texto plano (nunca uppercase),
  sempre com ícone em pill antes, na mesma linha.
- Botão: 13.5px, peso 600.
- Rótulo de campo: 12.5px, peso 500, `text-ink-soft`.
- **Campo no celular vai a 16px.** Abaixo disso o iOS dá zoom ao focar e não
  desfaz sozinho.

## Rotas

Cada tela tem endereço próprio (no original isso foi conquistado com
`history.pushState`; aqui é o App Router e sai de graça):

```
/entrar                                    login
/painel                                    home
/painel/clientes                           lista
/painel/clientes/<id>                      ficha
/painel/clientes/<id>/contrato             revisão e confirmação
/painel/pendencias                         precisa de atenção
/painel/tempo                              previsão detalhada
/painel/configuracoes                      perfil, localização, segurança
/painel/configuracoes/contrato             modelos e assinaturas
/painel/configuracoes/contrato/<id>        editor de um modelo
/cadastro · /proposta · /assinar            telas do casal, sem AppShell
```

## Ritmo e elevação

O container do conteúdo vive no `AppShell` (`main`), que já dá o respiro
lateral. Gap entre cartões: 14px em grade de KPI, 20px nas colunas da ficha.

1. Fundo da página: `bg-soft`.
2. Seção (`Secao`): fundo `bg-paper`, sem borda, `shadow-card`. O que está
   dentro dela fica num pastel petróleo bem sutil (`#F7F9FA`, hover `#F0F4F6`)
   só o suficiente pra separar sem pesar.
3. Card de indicador e card de atenção: mesma `shadow-card`, hover
   `shadow-card-hover`.
4. Hero da ficha: gradiente petróleo, sombra própria, texto branco.

Nada usa borda pra elevar. `line` só aparece como fundo de hover ou como
hairline interna.

## Componentes

### Botões (`Botao`)

`h-11`, `rounded-[10px]`, 13.5px peso 600, ícone 16 à esquerda com gap 8.

- `primario`: `bg-accent` cheio, texto branco. Hover `accent-hover`, active
  `scale(.96)`.
- `secundario`: `bg-soft`, texto `accent`. Hover vira `bg-line`.
- `fantasma`: `bg-soft`, texto `ink-soft`. Hover `bg-line`, texto `ink`. É o
  "Cancelar" dos modais.
- `perigo`: vermelho sólido com texto branco. Excluir, cancelar contrato.

### Avatar e sino do cabeçalho

Compartilham a MESMA animação, pra combinarem: no hover e com o menu aberto,
pop sutil (`scale(1.08)`) com sombra suave atrás e easing com respingo de
overshoot (`cubic-bezier(.34,1.4,.5,1)`); `active` volta a `scale(1.02)`. Nada
de anel. Neutralizados no toque, senão o estado gruda depois do toque.

### Hero da ficha

Fundo em camadas (luz radial no canto mais gradiente petróleo), radius 22,
sombra externa forte mais borda de luz interna.

**Hierarquia, que é o ponto:** o hero NÃO empilha pílulas iguais. Só a
**data/contagem** é pílula em destaque (branca sólida, texto accent). **Local e
valor** são texto leve (`rgba(255,255,255,.72)`) separados por um ponto, sem
fundo de vidro. O **status do contrato só vira pílula quando é marco forte**
(assinado); o resto do tempo ele vive na coluna da direita e não se repete aqui.

Não tem badge de status do cliente nem ação de contrato no topo: o `hero-topo`
guarda só arquivar e excluir.

### KPIs

Os quatro indicadores vivem num **card único**, não em quatro cartões soltos. As
células são divididas por hairlines que são o próprio fundo do container
aparecendo por um `gap-px` sobre `bg-line`: nada de borda por célula, e a
divisória vira cruz sozinha quando cai pra 2x2 no celular. `overflow-hidden`
mais radius 16 arredondam os cantos externos. Ícone no canto superior direito
numa pill `accent-tint` 34x34. Sem hover: é um card só, as células não são
tocáveis.

### Lista de clientes

Card único, radius 20, sombra mais funda que a padrão. **Linhas sem divisória**:
o que separa é o respiro (17px vertical) e o hover `bg-soft`. O cabeçalho se
diferencia pelo tom, não por linha. Busca e filtro acima seguem a regra dos
campos: fundo `soft`, nenhuma borda. No celular cada linha vira o próprio
cartão com `shadow-card`, e o estado vazio usa `bg-soft` em vez de contorno
tracejado.

### Saudação da Home e clima

Uma linha: emoji grande (46px, 40px no celular) à esquerda e, ao lado, título e
subtítulo em coluna.

- Título: "Bom dia," em peso 400 mais o nome do estúdio em peso **800**.
- Subtítulo: o resumo do tempo quando há localização salva; sem localização,
  uma frase de apoio em itálico.
- Emoji: sem localização é o da hora; com localização é o do clima.

**Nada de emoji provisório antes do clima:** o emoji e o subtítulo ficam em
shimmer até a busca do clima resolver. Piscar um emoji e trocar depois parecia
defeito.

**Cor condicional da temperatura:** frio (até 14°) puxa azul acinzentado,
quente (26° ou mais) puxa terracota, ameno fica `ink-soft`.

Com previsão na tela, o resumo vira um **link que não parece link** (só cursor,
sem sublinhado nem cor de link) pra `/painel/tempo`.

### Notificações

O sino abre um dropdown (card branco, radius 16, `shadow-alta`). **Abrir é
ler**: o badge zera na hora, sem esperar refetch.

- Altura travada: a lista rola por dentro, sem quebrar o layout.
- Texto: título em negrito com o EVENTO (Novo cliente, Contrato assinado, Casal
  abriu o contrato, Aguardando assinatura, Casamento em X dias) e sub discreto
  com o casal. Telefone fica de fora. Os dois cortam com reticências.
- **Deslizar e revelar:** o kebab desliza a frente do item pra esquerda e
  revela duas ações, "Não lida" (petróleo) e "Apagar" (vermelho). No toque dá
  pra arrastar com o dedo. Um timer de 3,5s recolhe sozinho se ninguém agir.
- **Onde fica guardado:** lido e apagado vão pro servidor (chave `avisos` do
  `/api/config`), não pro localStorage: precisa acompanhar entre celular e PC.
  A chave do aviso inclui o status (`contrato|id|status`), então se o contrato
  mudar de estado o aviso reaparece.
- No celular o dropdown vira tela cheia que entra deslizando na horizontal, sem
  botão X: fecha pelo gesto de voltar ou tocando de novo no ícone.

### Navegação do celular

A barra de baixo é a fonte da verdade da ordem: **home 0, clientes 1, avisos 2,
busca 3, conta 4**. Ir pra um ícone à direita faz a tela entrar da direita; à
esquerda, da esquerda. A barra fica POR CIMA das telas cheias, então é sempre
tocável, e por isso nenhuma delas tem botão X.

### Voltar

Muda de lugar conforme o tamanho da tela, e nunca aparecem os dois:

- **Desktop:** botão no topo do conteúdo, com ícone e rótulo ("Início").
- **Celular:** só o ícone, ancorado à esquerda do cabeçalho.

### Card de atenção e pendências

Card na Home que leva pra `/painel/pendencias`: fundo terroso `#F8F4EE`, ícone
em pill taupe, contagem em badge taupe, tom sobre tom. Some quando não há
pendência.

A página agrupa três frentes, calculadas do `contrato_status` que a lista já
traz: **contrato não enviado** (rascunho), **aguardando o casal assinar**
(enviado ou visualizado) e **confirmado sem contrato**. Arquivado e realizado
não contam. Cada item tem nome em cima e data abaixo como subtítulo.

O botão **Limpar** dispensa uma pendência: a chave `grupo|id|status` vai pro
`localStorage` e a pendência some da lista e do contador, **sem tocar o banco**.
Como a chave inclui o status, se o contrato mudar de estado ela reaparece.

**Título mais subtítulo é o padrão de página interna:** h1 colado no topo e uma
linha de 14px em `ink-soft` explicando o que a página resolve.

### Seção (`Secao`)

Legenda com ícone em pill (30x30, radius 9, `bg-accent-tint`, ícone 15 em
`text-accent`; 36x36 com ícone 17 na Home) e texto 13px peso 600, na mesma
linha. Nunca o ícone acima do título.

Na Home, "Próximos eventos" lista no máximo **5**, sem rolagem, cada linha com
nome em cima e data abaixo. À direita, o kebab desliza a linha e revela **Abrir**
(petróleo) e **Copiar** (aço, apagado enquanto não há contrato).

### Modais

- **Confirmação** (`useConfirmar`): radius 16, max-width 420, título 22px com
  ícone em pill 32x32 inline à esquerda, corpo em `ink-soft`. Continua cartão
  centrado nos dois tamanhos: é pergunta curta.
- **Link do casal**: mesmo cartão, campo sem borda com botão de copiar no canto
  (que vira verde ao copiar) e banner âmbar abaixo.
- **Assinatura**: no desktop cartão de 520px (mais largo por causa do canvas);
  no celular vira **sheet de 80dvh** colado embaixo, cantos arredondados só em
  cima. Só este vira sheet.

### Timeline do contrato

Passos verticais com badge circular 28x28 e linha conectora de 2px entre eles.
Pendente: badge `soft` com ícone tracejado e título em `ink-soft`. Concluído:
badge `accent` com check branco, e a linha acima fica accent. Assinado: variante
verde.

### Editor de modelo de contrato

Ocupa a página inteira, no formato do Google Docs: o nome do arquivo É o título
da página (campo editável no cabeçalho) com o estado do salvamento logo abaixo.
**Não existe botão de salvar nem pré-visualização.** A barra de formatação é só
de ícones: estilo do bloco, negrito, itálico, quatro alinhamentos, duas listas e
o menu Inserir (campos do casal, tabela de itens, bloco de assinaturas). No
celular ela quebra em duas linhas. Cabeçalho e barra formam um bloco fixo só.

**Abas sublinhadas** (usadas no modal de assinatura) são o padrão quando as
opções trocam o MESMO conteúdo: trilho `line` sob a faixa e traço de 2px em
accent sob a aba ativa. Diferente da aba em pílula preenchida, que separa
conteúdos distintos.

> **Snapshot na geração:** ao gerar um contrato, o servidor copia
> `conteudo_html`, `conteudo_json` e `nome` do modelo padrão pra dentro do
> contrato. As telas de revisar e assinar e o PDF leem o snapshot. Editar um
> modelo NUNCA muda contrato já gerado.

### Campos

Sem borda. `bg-soft`, radius 8, padding `9px 12px`. Foco muda o fundo, sutil.
Rótulo 12.5px peso 500 acima, gap 6. Ação do rótulo (tipo "Esqueci a senha")
vai na mesma linha do rótulo, alinhada à direita.

### Contagem

Chip ao lado do h1: `min-w-6 h-[22px]`, radius 999, `bg-soft`, texto `ink-soft`
12.5px peso 600. Some quando vazio.

## Hover

Duas paletas, nunca borda:

- **Sobre fundo branco:** hover `bg-soft`.
- **Sobre fundo soft, ou ação secundária:** hover `bg-line`.

**Todo hover mora dentro de `[@media(hover:hover)]:`.** Sem isso, no celular o
estado gruda depois do toque e não volta. O retorno no toque fica por conta do
`active`.

## Skeleton, entrada e pull-to-refresh

Toda página de lista mostra **skeleton** enquanto carrega (`Sk`, `SkLinha`,
`SkCirculo`). O shimmer é lento e de baixo contraste de propósito, quase uma
respiração, não um flash. Nenhum bloco sai do shimmer antes do outro: se um
dado demora, todos esperam (com teto, pra um serviço fora do ar não travar a
tela).

Quando o conteúdo real entra, os blocos fazem **fade mais slide-up escalonado**
(`animate-entra`, 90ms por bloco). Suaviza a troca em vez do corte seco.

No pull-to-refresh o skeleton é **segurado por um mínimo de ~900ms**: o fetch
volta num instante e sem isso ele só piscaria.

**Pull-to-refresh é só no toque** e só no topo da rolagem. A ficha fica de fora:
tem formulário em edição, e recarregar perderia o que está sendo digitado.

## Toast

Fixo embaixo e centrado, `bg-noir`, texto branco 13.5px peso 500, radius 12,
`shadow-alta`. Fade mais slide-up. No celular sobe acima da barra de navegação.

## O que este painel NÃO faz

- Não usa serifada. Só Inter.
- Não usa anel de foco. Em lugar nenhum.
- Não usa borda pra diferenciar seção ou estado.
- Não usa travessão em texto de tela.
- Não pinta o card inteiro com cor de status. A cor fica no chip, no badge ou no
  ícone; o card continua branco.
