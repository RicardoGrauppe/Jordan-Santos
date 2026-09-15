# Design do Estúdio (área do Jordan)

Mapa da identidade visual usada na área interna do Jordan: `estudio.html`, `configuracoes.html`, `revisar-contrato.html`, `assinar.html` (contexto de leitura). É outro sistema, não confunde com o portfólio.

Guia complementar: `TOM-DE-VOZ.md` (voz e microcopy do app).

Fonte da verdade: `Website/brandbook-estudio.html` (peça visual).

---

## Filosofia

Área de trabalho, não vitrine.

- **Sem borda pra separar/diferenciar estado.** Fundo diferente (`--soft`) + sombra sutil resolvem. Regra do vault.
- **Sem focus ring.** Feedback de teclado vem de mudança sutil de fundo, nunca `box-shadow`/`outline` colorido.
- **Sem travessão em texto de tela.** Vírgulas, dois-pontos, parênteses.
- **Uma família tipográfica só** (Inter). `--serif` também aponta pra Inter aqui dentro, de propósito. Par serifada+sans é regra do que o CASAL vê (portfólio, cadastro, revisar, assinar).
- **Ícones Lucide** sempre, com stroke-width 1.8 e cor herdada do texto ou `--accent`.

## Paleta

Definida em `:root` no topo do `<style>`.

| Token           | Hex        | Uso                                                         |
| --------------- | ---------- | ----------------------------------------------------------- |
| `--paper`       | `#FFFFFF`  | Fundo do body e dos cartões elevados (KPI, fieldset)        |
| `--ink`         | `#1F2329`  | Corpo de texto principal                                    |
| `--ink-soft`    | `#6B7280`  | Legenda, label, texto de estado pendente                    |
| `--accent`      | `#003646`  | Petróleo. Ações primárias, ícones em pill, hero, títulos    |
| `--accent-deep` | `#4F6278`  | Aço. Uso pontual em valor/preço                             |
| `--noir`        | `#1D1D1B`  | Toast, texto de tooltip                                     |
| `--line`        | `#E4E6EA`  | Hover secundário (só como bg de estado, nunca como borda)   |
| `--soft`        | `#F6F7F9`  | Fundo de input, hover primário, "chip" cinza                |
| `--ok`          | `#2E6B4F`  | Sucesso, timeline concluída (variante "assinado")           |
| `--erro`        | `#A33B3B`  | Perigo (excluir, cancelar contrato)                         |
| `#EAF1F3`      | pastel petróleo | Fundo das "pills" de ícone (kpi-icone, legend-icone, mc-icone) |
| `#FBF6E8`      | âmbar suave     | Banner âmbar (aviso liberado, rascunho no revisar)          |
| `#B99524`      | dourado sutil   | Cor do ícone e do texto do banner âmbar                     |

## Tipografia

- **Inter**, pesos 400/500/600. Corpo em 14.5px, `line-height:1.55`, `font-smoothing:antialiased`.
- `h1`: 22px, peso 600, `letter-spacing:-.01em`.
- Saudação da home usa a mesma h1.
- Título de card interno (h3 do modal): 22px, peso 600.
- Legend de fieldset: 13px, peso 600, texto plano (não uppercase). Sempre com ícone antes, no wrapper `.legend-icone`.
- KPI número: 28px, peso 600, `font-variant-numeric:tabular-nums`.
- KPI rótulo: 11px, `.08em`, uppercase, `--ink-soft`.
- Botão: 13.5px, peso 600.
- Label de campo: 12.5px, peso 500, `--ink-soft`.

## Rotas (path-based)

Cada tela do estúdio tem **endereço próprio**, acessável direto pelo domínio (2026-09-09):

- `/estudio` → home
- `/estudio/clientes` → lista de clientes
- `/estudio/pendencias` → "Precisa de atenção"
- `/estudio/tempo` → previsão do tempo detalhada
- `/estudio/cliente/<id>` → detalhe do cliente
- `/configuracoes` → configurações (arquivo próprio, `configuracoes.html`)

`enderecoDaTela(estado)` monta o caminho; `mostrar()`/`irPara()` empurram via `history.pushState`; o **boot lê `location.pathname`** e abre a tela certa (aceita ainda os query params antigos `?cliente=`/`?tela=` como fallback). O `popstate` restaura pelo `history.state`. As telas cheias mobile (busca, avisos, conta) continuam como overlay sem rota (abrem por cima, mantêm o endereço da tela de baixo). Pra o F5 e o link direto numa sub-rota não darem 404, tanto o `dev-server.mjs` quanto o `vercel.json` (`rewrites`) reescrevem `/estudio/*` para o `estudio.html`.

## Ritmo e layout

- `.miolo{max-width:980px;margin:0 auto;padding:0 24px}` é o container central da área interna.
- `.pagina-topo` é o header de cada tela (título + ações), `margin:40px 0 22px`, flex wrap.
- Gap entre cartões em grid: 14px (`.kpis`) ou 20px (`.detalhe-colunas`).

## Elevação (níveis)

1. **Body branco** (`--paper`).
2. **Seções da home** (`fieldset`): fundo `--soft`, sem borda, sombra leve `var(--sombra-card)` (`0 1px 2px rgba(29,29,27,.04), 0 6px 16px rgba(29,29,27,.05)` — topo curto + lift difuso baixo). Os elementos de dentro (eventos, cards de link) ficam **brancos** pra saltar do fundo soft.
3. **Cards de indicador** (`.kpi` unificado) e **card de atenção**: mesma `var(--sombra-card)`; hover usa `var(--sombra-card-hover)`.
4. **Hero do cliente** (`.hero-cliente`): gradiente petróleo, sombra própria, texto branco.

Sombra premium centralizada nas vars `--sombra-card` / `--sombra-card-hover` (`:root`) — reusar em card novo. Nada usa borda pra elevar; `--line` só aparece como bg de hover ou como hairline interna (gap dos KPIs).

## Componentes-chave

### Botões

- **`.botao-primario`**: `--accent` cheio, texto branco, radius 10, padding `10px 16px`, sombra sutil `0 1px 2px rgba(0,54,70,.22)`. Hover escurece pra `#00485c`, active `scale(.96)` (micro-animação Framer). Ícone 16×16 à esquerda.
- **`.botao-secundario`**: bg `--soft`, texto `--accent`, sem borda. Hover: bg vira `--line`. Mesmo padding e radius do primário. Micro-animação Framer: `active { transform: scale(.96) }`.
- **`.botao-fantasma`**: sem borda, bg `--soft`, texto `--ink-soft`, radius 10. Hover: bg `--line`, texto `--ink`. Usado como "Cancelar" em modais.
- **Variante `.perigo`**: no primário fica `--erro` com sombra vermelha; no menu-opcoes fica bg pastel `#FBEBEB` com texto `--erro`.

### Ícones do topo: avatar e sino

Avatar (`.avatar-topo`) e sino (`.botao-notificacao`) no header compartilham a **mesma animação** (2026-09-09), pra combinarem: no hover e com o menu aberto (`aria-expanded`), dão um **pop sutil** (`transform:scale(1.08)`) com **sombra suave atrás** (`0 5px 16px rgba(29,29,27,.18~.24)`), easing com respingo de overshoot (`cubic-bezier(.34,1.4,.5,1)`), `active` volta a `scale(1.02)`. **Nada de anel/ring** (o anel `--accent` que o avatar tinha saiu). O sino também troca o fundo pra `--soft` no estado ativo. Ambos neutralizados no bloco `@media (hover:none)` pra não grudar no toque.

### `.hero-cliente`

Cabeçalho da ficha. Fundo em camadas: luz radial no canto superior esquerdo + `linear-gradient(135deg,#013243,#003646,#0b4d61)`. Radius 22, padding `30px 32px 28px`, margin-bottom 40. Sombra externa `0 14px 34px rgba(0,54,70,.22)` + borda de luz interna `inset 0 1px 0 rgba(255,255,255,.07)`. Duas esferas de brilho em `::before`/`::after` dão profundidade. Contém `.hero-topo` (só ações à direita), `.hero-corpo` (avatar + nomes + hierarquia de meta).

**Hierarquia de informação (importante):** o hero NÃO empilha pílulas iguais. Só a **data/contagem** é pílula em destaque (branca, `.hero-chip.destaque`). **Local e valor** viram `.hero-meta` (texto leve `rgba(255,255,255,.72)`, sem fundo de vidro, separados por um ponto sutil). O **status do contrato NÃO se repete no hero** (já vive na coluna da direita); só entra como pílula destaque quando é um marco forte: `assinado`. Isso mantém o card respirado em vez de virar uma parede de chips.

**O que NÃO fica no hero (poda de 2026-09-09):**
- Sem badge de status do cliente (novo/confirmado/realizado). Era ruído; quem abre a ficha já sabe de quem é.
- Sem ícone de ação de contrato no topo. A ação já vive na coluna da direita (card "Contrato" + "Abrir contrato") e no botão da seção. O `.hero-topo` guarda só **arquivar** e **excluir**.

Peças:
- `.hero-avatar`: 74×74 círculo, degradê translúcido + brilho interno + sombra própria, iniciais do casal em `&` itálico.
- `.hero-chip.destaque`: pílula branca sólida, texto `--accent`, sombra suave. Único chip que sobra no hero (a data).
- `.hero-meta` / `.hero-meta-item`: meta secundária (local, valor) em texto leve, com bullet `::before` de separação. Sem fundo.
- `.hero-icone`: botão de ação circular translúcido no topo direito (arquivar, excluir). `.perigo` fica vermelho no hover.

### `.kpis` + `.kpi`

Os 4 indicadores da home vivem num **card único** (`.kpis`), não em 4 cartões soltos. O card é branco com sombra dupla premium; as células (`.kpi`) são divididas por hairlines que são o próprio fundo `--line` do container aparecendo por um `gap:1px` (truque grid-gap-como-divisor: nada de borda por célula, funciona em qualquer nº de colunas). `overflow:hidden` + radius 16 arredondam os cantos externos. Desktop: 4 colunas; `≤700px`: 2×2 (a divisória vira uma cruz automaticamente).

Cada célula: padding `20px 22px`, ícone Lucide no canto superior direito num quadradinho pastel `#EAF1F3` 34×34. Número 28px `--accent`, `padding-right:44px` pra não colidir com o ícone. Rótulo pequeno `.08em` uppercase `--ink-soft`. A célula de data ("Próximo casamento") usa `.kpi-num-data` (19px, formato humano "24 out 2026") pra não estourar. Sem hover nas células (é um card só, não são tocáveis individualmente).

### `.tabela-card` (lista de clientes)

Card único, sem borda: `background:var(--paper)`, radius 20, sombra premium de duas camadas (`0 1px 2px rgba(29,29,27,.04), 0 14px 32px rgba(29,29,27,.08)`, mais funda que o `--sombra-card` padrão do app). Linhas sem divisória — só o padding generoso (17px vertical) e o `tr:hover{background:var(--soft)}` separam uma da outra; o cabeçalho (`thead th`) se diferencia pelo tom `--soft`, não por linha. `.campo-busca` e o `select` de status acima seguem a mesma regra: fundo `--soft`, nenhuma borda (igual à busca do topo). `.avatar-inicial` (iniciais do casal) é só bg `--soft`, sem anel. Mobile (`≤720px`): cada `<tr>` vira o próprio cartão com `box-shadow:var(--sombra-card)` no lugar de borda (mesmo tratamento de `.tempo-agora`/`.tempo-luz`); o estado vazio usa `background:var(--soft)` em vez de contorno tracejado. Redesenho de 2026-09-10 (Ricardo pediu minimalista, sombra premium, zero linha de borda).

### Saudação (home) + previsão do tempo

A saudação é uma linha (`.saud-linha`, flex, `align-items:center`) com um **emoji grande** (`.saud-emoji-grande`, 46px / 40px no mobile) à esquerda e, ao lado, um bloco em coluna (`.saud-bloco`) com título e subtítulo, centralizados verticalmente ao emoji.
- **Título** (`#saudacao-home`): "Bom dia," (`.saud-ola`, peso 400, `--ink`) + "Jordan Santos." (`.saud-forte`, peso **800**, nome completo). Sem emoji dentro do h1.
- **Subtítulo** (`.saud-sub`): o **resumo do tempo** quando há localização salva; sem localização, cai numa frase de apoio rotativa e enérgica (com `.saud-sub.frase` em itálico).
- **Emoji** reflete o estado: sem localização é o emoji da hora (☀️/🌤️/🌆/🌙); com localização vira o ícone do clima (☀️ ⛅ ☁️ 🌧️ ⛈️ 🌨️ 🌫️…).

**Clima (Open-Meteo, grátis, sem chave):** `carregarClima()` lê `/api/config` (localização). Se houver, busca `api.open-meteo.com/v1/forecast` por lat/lon (`current=temperature_2m,weather_code,is_day` + `daily` máx/mín) e monta um resumo **curto, sem a cidade** (o Jordan já a configurou): "`{descrição}, {temp}°`" + um par mín/máx alinhado por setas (`.saud-minmax`, "↓17° ↑25°"). `climaInfo(code, ehDia)` mapeia o WMO weather_code pro emoji + descrição. **Esqueleto:** `atualizarSaudacao()` escreve só o título; o emoji e o subtítulo ficam em shimmer até `carregarClima()` resolver, pra nunca piscar um emoji provisório antes do clima. Fecha o esqueleto o clima (emoji real) ou `saudacaoFallback()` (emoji da hora + frase) quando não há localização/a API falha. A localização é definida em **Configurações → Localização**: o campo de cidade é geocodificado pela `geocoding-api.open-meteo.com` (client-side) e `{cidade,nome,lat,lon}` é salvo em `/api/config` (tabela `config`, chave `localizacao`).

**Cor condicional da temperatura (`corTemp(t)`):** cada número de temperatura ganha uma cor **sutil** conforme o valor: frio (≤14°) puxa azul acinzentado, quente (≥26°) puxa terracota, ameno fica `--ink-soft`. Usada na mín/máx da home e nos dias/agora da página detalhada.

**Link camuflado:** com previsão na tela, o resumo (e o emoji) viram um link **que não parece link** (`.tempo-link`, só `cursor:pointer`, sem sublinhado/cor de link) pra `/estudio/tempo`.

### Previsão do tempo detalhada (`/estudio/tempo`)

Página cheia (tela `tempo`, grupo "home") aberta pelo clima da saudação. `carregarTempo()` lê a localização e busca a Open-Meteo (`current` + `hourly` + `daily`, 7 dias). Blocos: **Agora** (`.tempo-agora`: emoji grande, temperatura, descrição, sensação, mín/máx coloridas, umidade, vento), **Luz do dia** (`.tempo-luz`, pro fotógrafo: uma **timeline** das fases de luz, barra `blue → golden → dia → golden → blue` com marcadores 🌅/🌇 posicionados por %, marcador "agora", legenda das golden/blue hours e índice UV; no topo, a **melhor janela de luz** do dia, escolhida comparando a chance de chuva/limpidez da golden hour da manhã x da tarde), **Próximas horas** (`.tempo-horas` dentro de `.tempo-horas-wrap`, ~12 cards roláveis quadrados: hora, emoji, temp; scrollbar fina estilizada; degradê nas bordas como convite pra rolar, direita enquanto há mais cards e esquerda depois que rolou, mais um nudge de 34px que vai e volta quando a lista aparece, toda vez que a página abre (uma vez por abertura, cancela se o usuário encostar), tudo em `iniciarRolagemHoras()`; nunca carrossel automático, é dado pra ler) e **Próximos dias** (`.tempo-dias`, 7 linhas: dia da semana, emoji, chance de chuva 💧 em azul, mín/máx coloridas). As duas seções abrem com o cabeçalho `cabecalhoSecao()` (`.tempo-secao-titulo`): emoji grande travado em 44px (🕒 / 📅), título 19px/800 e linha de apoio com dado real (`12 horas · 20° a 24°`), o mesmo padrão do topo do card "Melhor luz do dia". O botão voltar de conteúdo some no mobile (fica no header, como nas outras telas). Sem localização, mostra um aviso com atalho pra Configurações; falha de rede tem mensagem própria. Tem `skeletonTempo()` enquanto carrega.

### Notificações (sino + dropdown)

O sino (`.botao-notificacao`) abre o `.dropdown-notificacao` (card branco, radius 16, sombra). Abrir = ler: zera o badge na hora (ver "Skeleton"/lógica de vistos abaixo). Badge `.ponto-notificacao` vermelho no canto.

- **Altura travada:** `.notif-lista` tem `max-height:min(56vh,400px)`, `overflow-y:auto` e `scrollbar-gutter:stable` — muitas notificações rolam por dentro sem quebrar o layout nem "pular" quando a barra aparece.
- **Texto (o que importa):** título em **negrito com o evento** (Novo cliente / Contrato assinado / Casal abriu o contrato / Aguardando assinatura / Casamento em X dias) e sub discreto com o **casal**. Telefone fica de fora. Título e sub cortam com reticências (`nowrap` + ellipsis) pra caber. Ícones: `user-plus` (novo cliente), `file-check` verde (assinado), `file-text` (contrato), `calendar` (prazo).
- **Timer + arraste (vale pros dois slides, notificações e eventos):** ao abrir, um timer de **3,5s** recolhe o slide sozinho se o Jordan não agir (`agendarFecharSlide`/`_timerSlide`, limpo nos `fecharMenus`). No **toque**, além do kebab, dá pra **arrastar** o item pra revelar (`habilitarArraste`: pointer events de toque seguem o dedo e, ao soltar, abrem ou recolhem; `touch-action:pan-y` deixa o scroll vertical livre; a classe `.arrastando` revela a ação durante o gesto; o clique logo após um arraste é engolido pra não abrir o detalhe).
- **Deslizar e revelar (estilo WhatsApp):** cada aviso é `.notif-item` (`position:relative; overflow:hidden`) com `.notif-acao-fundo` (ações atrás, encostadas à direita) + `.notif-desliza` (camada da frente, bg `--paper`). Clicar no kebab (`.notif-kebab`, três pontinhos) adiciona `.aberto` e desliza a frente `translateX(-176px)` (cubic-bezier), revelando **duas ações** que dividem o espaço: **"Não lida"** (`.notif-acao.lida`, petróleo `--accent`, ícone envelope) e **"Apagar"** (`.notif-acao.apagar`, vermelho `--erro`, ícone trash). "Não lida" remove a chave dos vistos (o badge volta a contar); "Apagar" põe a chave na lista de apagados e o aviso some da lista e do contador (volta se o estado mudar, porque a chave inclui o status). Ambos persistidos no servidor (chave `avisos` de `/api/config`, tabela `config`), não em localStorage — precisa acompanhar o Jordan entre celular e PC. Clicar fora, em outro kebab, ou Esc recolhe. Não há menu popover. **Sem `scrollbar-gutter`** (deixava uma linha à direita); a lista só rola quando precisa.
- **Mobile (tela cheia):** no celular o dropdown vira uma `.tela-mobile` que **entra deslizando na horizontal** (ver "Navegação mobile direcional" abaixo). **Não tem mais botão X**: fecha por gesto de voltar, por tocar de novo no ícone (toggle) ou por trocar de tela na navbar. Os itens **não têm divisor** entre si e **sem hover** (neutralizado no `@media (hover:none)`); o deslizar/revelar do kebab funciona igual ao desktop.

### Menu da conta (avatar)

No desktop o avatar do header abre o `.dropdown-avatar` (**Contrato e assinatura**, Configurações, Sair). No **mobile** vira uma página cheia `#conta-mobile` (`.tela-mobile`) que **entra deslizando na horizontal**, no sentido ditado pela posição do ícone na navbar (ver "Navegação mobile direcional"). Conteúdo: card de plano premium com o perfil dentro (avatar + "Jordan Santos" / "Legacy") e os itens `.conta-item` (Contrato e assinatura, Configurações e Sair em vermelho). **"Contrato e assinatura" saiu da sidebar de Configurações** e agora vive no menu da conta (desktop + mobile); os dois apontam pra `/configuracoes?painel=contrato`, que o boot do configuracoes.html lê pra abrir o painel de contrato direto. A navbar mobile ("Perfil") abre essa página; o gesto de voltar / Esc / tocar noutro ícone fecham (mesma malha de histórico das outras telas cheias). Sem botão X.

### Navegação mobile direcional (estilo Facebook)

No mobile (≤820px) a troca de telas **desliza na horizontal**, no sentido que a ordem dos ícones da navbar pede, em vez de subir de baixo pra cima. A ordem é a fonte da verdade (`POS_NAV`): **home 0 · clientes 1 · avisos 2 · busca 3 · conta 4**. Ir pra um ícone **à direita** faz a tela nova **entrar da direita**; **à esquerda**, **entrar da esquerda**. Vale igual pras telas de verdade (home/clientes, classes `.miolo.desliza-dir`/`.desliza-esq` via `aplicarSlidePagina`, guardado por `ehMobile()` no `mostrar()`) e pras telas cheias (avisos/busca/conta: padrão entra da direita, classe `.de-esquerda` inverte). `_posMobile` guarda o índice atual e `_posBase`/`_telaBase`, o da tela real por baixo; ao fechar uma tela cheia o índice volta pro da tela real (no `mostrar` e no `popstate`), e o slide de troca overlay↔overlay compara com a posição da que estava aberta (por isso `fecharTelaMobile` **não** reseta o índice sozinho).

A **navbar fica por cima das telas cheias** (`z-index:70` > `60`), então é sempre tocável: trocar de tela ou tocar de novo no ícone da tela aberta (toggle, via histórico) fecha — **não há botão X**. O corpo das telas cheias reserva `padding-bottom:88px` pra não ficar sob a navbar, e `.conteudo` tem `overflow-x:clip` pra o deslize não gerar barra lateral. No desktop nada disso vale (os dropdowns do header seguem intactos).

**Push/pop entre a Conta e /configuracoes (cross-document, estilo iOS):** a Conta é overlay no `estudio.html`, mas "Contrato e assinatura" e "Configurações" levam pra outro documento (`/configuracoes`). Pra a troca parecer a mesma pilha, uso **View Transitions cross-document** (`@view-transition{navigation:auto}`, só dentro do `@media (max-width:820px)`, presente nos dois arquivos). Ir pra frente (abrir a partir da Conta) é o tipo **`forward`**: a página nova entra deslizando da direita, **por cima** (z-index 2), e a de baixo fica **parada** (z-index 1, `animation:none`). **Voltar** é o tipo **`back`**: a página de cima (a que fecha) sai deslizando pra direita (z-index 2) e **revela a de baixo parada** (z-index 1), sem a de baixo sobrepor a de cima. Keyframes `vt-entra-direita` / `vt-sai-direita`, tipos escopados por `:root:active-view-transition-type(...)::view-transition-old/new(root)`. O sentido é marcado no **clique do link** (`sessionStorage.JSF_VT`: link pra `/configuracoes` → `forward`, link pra `/estudio` → `back`) e lido no `pageswap`/`pagereveal`, com fallback pro índice do histórico quando é `traverse` real (gesto ou botão do navegador). Pro **pop** revelar a Conta já montada e parada embaixo (e não deslizando por cima do que fecha), um script no topo do `<body>` do estudio marca `html.boot-conta` **antes da 1ª pintura** quando a URL volta com `?conta=1` (o CSS monta a `#conta-mobile` na hora), e o boot abre a Conta **sem o slide próprio dela** (`abrirTelaMobile(el, semAnim)`), deixando a animação por conta da transição de página. No desktop o opt-in não vale, então as navegações entre documentos não ganham transição.
- **Vistos:** cada aviso tem uma `chave` estável desacoplada do texto (`proposta|id`, `contrato|id|status`, `assinado|id`, `prazo|id`). Abrir o sino grava tudo como visto (some o badge na hora, sem depender do refetch); "marcar como não lida" remove uma chave. Guardado no servidor via `/api/config` (ação `salvar-avisos`), carregado uma vez por sessão (`garantirAvisosCarregados()`) e mantido em memória — não em localStorage (2026-09-10).

### Login

Card estilo shadcn (`.login-card`): branco radius grande com sombra premium sobre fundo `--soft`, logo no topo, saudação leve ("Bem-vindo de volta 👋", peso 500 com emoji), campos com placeholder, link "Esqueci a senha" na linha do label da senha (dispara o e-mail de recuperação via Supabase), botão petróleo retangular com a micro-animação Framer.

**Mobile é estático de propósito (2026-09-09):** `#tela-login` fica `position:fixed; inset:0; overflow:hidden; touch-action:none` — sem scroll e sem gesto de pan/pinça, usabilidade de app. O JS (`travarZoom`) ainda troca o `<meta viewport>` pra `maximum-scale=1, user-scalable=no` enquanto o login está na tela e restaura ao entrar no app (pra não prejudicar acessibilidade no resto). O zoom de foco do iOS já não acontece porque os inputs vão a 16px no mobile.

### Voltar: desktop em conteúdo, mobile no header

Regra de navegação (2026-09-09): o botão "voltar" muda de lugar conforme o tamanho de tela.
- **Desktop**: botão `.voltar` no topo do conteúdo, com ícone `arrow-left` + rótulo ("← Início").
- **Mobile (≤820px)**: o `.voltar` de conteúdo some; no lugar entra `#voltar-mobile`, **só o ícone**, ancorado à esquerda do header (`.topo-voltar`, absolute, 38×38, hover `--soft`). Um botão só no header serve todas as telas — o JS roteia conforme a tela aberta (detalhe → de onde veio, pendências → home) e o `mostrar()` liga/desliga ele nas telas que têm volta.

Nunca mostrar os dois ao mesmo tempo: `.topo-voltar` é `display:none` no desktop; o `.voltar` de conteúdo é `display:none` no mobile.

### `.card-atencao` + página de pendências

Card na home (abaixo da saudação) que leva à página "Precisa de atenção". Fundo terroso suave (`#F8F4EE`, âmbar puxado pro taupe pra matar o brilho amarelo), ícone em pill taupe (`#EBE2D3`/`#8A6A3C`) e contagem em badge taupe (`#EBE2D3`/`#6F5228`) — tom sobre tom marrom, nunca âmbar forte. Sem borda, sombra leve (`var(--sombra-card)`). Some quando não há pendência (`hidden`). Hover sobe 1px. Afinado em 2026-09-09 pra ficar slim e alinhado aos outros cards: radius **16**, padding `13px 15px`, ícone 36×36, contador 23px, título 14px, sub 12.5px, e a setinha `chevron-right` num taupe suave (`#B4A489`) em vez do cinza `--ink-soft`.

A página `#pagina-pendencias` agrupa o que precisa de ação, calculado a partir do `contrato_status` que a lista (`/api/estudio?lista=1`) já traz. Três frentes: **Contrato não enviado** (rascunho), **Aguardando o casal assinar** (enviado/visualizado), **Confirmado sem contrato** (confirmado e sem contrato). Arquivado e realizado não contam. Cada grupo tem um cabeçalho (ícone pastel + título + contagem à direita) e uma lista de `.pend-item` (avatar + bloco `.pend-item-texto` com **nome em cima e data abaixo como subtítulo** em `--ink-soft`) que abre o detalhe do cliente no clique. Sem pendência: mensagem "Tudo em dia". A página é registrada em `telas`/`GRUPO_DA_TELA` no grupo "home".

**Título + subtítulo (`.pagina-titulo-bloco` / `.pagina-sub`):** o h1 da página vem colado ao topo (voltar `22px` topo, `.pagina-topo` `8px` topo nesta página) com um subtítulo explicativo abaixo (14px, `--ink-soft`): "Pontas soltas e passos esquecidos: rascunhos pra enviar, contratos esperando assinatura e clientes confirmados sem contrato." (tom + resumo das 3 frentes). Esse par título/sub é o padrão pra páginas internas.

**Botão "Limpar" (`.pend-limpar`):** cada `.pend-item` tem, à **direita**, um botão **verde sólido clarinho** (`#3E9E6C`, texto branco, ícone `check`, hover `#369061` + lift 1px, active `scale(.96)`) que dispensa aquela pendência. Clicar abre o modal de confirmação (`confirmar()`); ao confirmar, a chave `grupo|id|contrato_status` entra em `localStorage["JSF_PEND_LIMPAS"]` e a pendência some da lista **e** do contador da home (nunca toca o banco). Como a chave inclui o status, se o contrato mudar de estado a pendência reaparece. `stopPropagation` no botão pra não abrir o detalhe.

### `fieldset` (seção do detalhe)

Na home o "Próximos eventos" lista no máximo **5** casamentos mais próximos (`.slice(0,5)`, sem scroll) e cada linha (`.evento-texto`) traz o **nome em cima e a data abaixo como subtítulo** (`.evento-data`, `--ink-soft`, empilhados em coluna). À direita, um **kebab de contrato** que, ao clicar, faz o item **deslizar pra a esquerda revelando as ações atrás** (mesmo padrão WhatsApp das notificações: `li` vira o clip `overflow:hidden`, `.evento-desliza` é a frente que translada `-176px`, `.evento-acao-fundo` fica atrás): **Abrir** (`.evento-acao.abrir`, petróleo, ícone conforme o estado, `file` vazio quando não há contrato; com contrato abre a revisão direto, sem contrato confirma e gera) e **Copiar** (`.evento-acao.copiar`, `--accent-deep`, reusa o modal de link do casal; fica **apagado/`.desativado`** quando ainda não há contrato). O kebab e as ações usam `stopPropagation`; clicar no conteúdo aberto recolhe; fecha também ao clicar fora / Esc. Na home o fieldset é **branco** (`--paper`) sem borda com `var(--sombra-card)`; os elementos internos (chips de evento, cards de link) ficam num pastel petróleo bem sutil `#F7F9FA` (hover `#F0F4F6`), só o suficiente pra separar do card sem pesar, com uma sombra fantasma (`0 1px 2px rgba(29,41,61,.03)`). No detalhe o fieldset segue branco. Legend com ícone em `.legend-icone` (28×28 pastel `#EAF1F3`) e texto de 13px peso 600. A barrinha vertical `::before` que existia foi removida em toda a home + detalhe.

### `.legend-icone` (e variação `.legend-icone-lg`)

Wrapper pra o ícone da legend NÃO ser destruído pelo `lucide.createIcons()` (que substitui `<i>` por `<svg>`). Regra CSS estiliza o `<span>` externo, não o `<i>`.

- Padrão: 30×30, radius 9, bg `#EAF1F3`, ícone 15×15 cor `--accent`.
- `.legend-icone-lg` (usada só na home): 36×36, radius 11, ícone 17px.

### Modal de confirmação (`.modal-confirm-caixa`)

Padding `32px 32px 26px`, radius 16, max-width 420, sombra padrão. h3 22px flex com `.mc-icone` (32×32 pastel `#EAF1F3`, ícone Lucide 16×16 `--accent`) inline à esquerda do título, gap 12. Corpo de texto em `--ink-soft` line-height 1.6. Ações no rodapé alinhadas à direita, gap 10, `margin-top:28px`.

### Modal do link (`#modal-link`)

Mesmo card. h3 padded à direita 34 pra o X não encostar. Campo `#ml-link` é input sem borda, bg `--soft`, radius 10, com botão de copiar `.btn-copiar` absoluto no canto direito (34×34, radius 8, sem bg em repouso; hover bg `--paper` texto `--accent`; classe `.copiou` vira `--ok`). Banner `.banner-liberado` (âmbar) abaixo com ícone info alinhado ao topo da primeira linha.

### Timeline do contrato (`.timeline-contrato`)

Passos verticais. `.timeline-passo` com badge 28×28 circular, ícone Lucide 14×14, e linha conectora 2px entre badges (via `::before`).

- **Pendente**: badge `--soft` com ícone `circle-dashed` cinza. Título em `--ink-soft`.
- **Concluído** (`.concluido`): badge `--accent` com `check` branco. Linha acima até o próximo passo fica `--accent`. Título em `--ink`.
- **Assinado** (`.assinado`): variante `--ok` (verde).

### Configurações (página única)

`/configuracoes` é uma **página única** (sem sidebar), coluna central (`#painel-config`, max-width 620) com três seções em cards (`.cfg-secao` + `.cfg-card`): **Perfil** (nome + nome de usuário, salvos no `config` chave `perfil`), **Localização** (cidade geocodificada pela Open-Meteo, salva em `config` chave `localizacao`) e **Segurança** (reset de senha: manda o link de redefinição pro e-mail via `/api/sessao` `recuperar`). Catálogo, Notificações e Integrações saíram por enquanto. O `?painel=contrato` (vindo do menu do avatar) esconde `#painel-config` e mostra o painel de contrato abaixo.

### Configurações: Contrato e assinatura

Em `/configuracoes → "Contrato e assinatura"` há **duas telas**, não uma:

1. **Índice (`#contrato-indice`)** é o que abre primeiro. Título + subtítulo ("Editar aqui não muda contratos já gerados"), depois:
   - **Modelos de contrato** (`.modelos-grade`): grade de `.modelo-card` (branco, `var(--sombra-card)`, sem borda; ícone `file-text` em pill pastel, nome, "Atualizado DD/MM/AAAA", e o selo **Padrão** no canto quando `ativo`). O último card é `.modelo-novo` (tracejado sutil, `+` centralizado) que cria um modelo novo copiando o padrão como base. Clicar num card abre o editor full-width daquele modelo.
   - **Assinaturas** (`#assinaturas-grade`): mesma forma da grade de modelos, com `.modelo-card.assin-card`. No lugar do ícone em pill o card mostra a **própria assinatura** (`.assin-amostra`, começando abaixo da faixa do canto pra não passar sob o selo), depois o nome e "Atualizada DD/MM/AAAA"; selo **Padrão** quando `ativo` e kebab com Definir como padrão / Renomear / Excluir. O último card é `.modelo-novo` ("Nova assinatura") e abre o **`#modal-assinatura`**, com X de fechar no canto superior direito. **No desktop é cartão centrado de 520px** (mais largo que os 440 do `#modal-confirm`, por causa do canvas); **no celular vira sheet de 80dvh** colado embaixo, cantos arredondados só em cima, subindo com `ma-sobe` e descendo com `ma-desce` antes de esconder. Só este modal vira sheet: o `#modal-confirm` é pergunta curta e continua cartão centrado nos dois tamanhos. Dentro dele, na ordem: "Nome desta assinatura" (primeiro campo, já preenchido com "Assinatura 1", "Assinatura 2"... pulando os números em uso) e a `.assinatura-caixa`, uma caixa `--soft` única com **abas sublinhadas** no topo (`Fonte cursiva` / `Desenhar` / `Enviar imagem`: sem fundo, cada uma com um terço da largura e o rótulo centralizado, trilho `--line` sob a faixa e traço de 2px em `--accent` sob a faixa inteira da ativa, que também fica em accent/600) e, embaixo, o preview e o campo daquele modo, num corpo de **altura travada em 270px** (a do modo mais alto, o desenho) pra o modal não pular ao trocar de aba; o preview estica pra ocupar a sobra nos modos mais baixos. Campos e canvas DENTRO da caixa vão pra `--paper`, senão sumiriam no cinza dela. Cada modo tem a SUA legenda de vazio, dizendo o que vai aparecer ali (nunca um texto genérico listando os três). Cursiva rende o texto digitado em fonte script; Desenhar **não tem preview** (o canvas já é a assinatura, repetir era redundância), então o canvas estica pra ocupar a caixa e o "Limpar" fica na direita, com uma **linha de assinatura** pra situar quem assina, feita em `background` CSS e não desenhada no canvas, senão entraria no `toDataURL` e sairia carimbada no contrato; Enviar imagem não usa o `<input type=file>` nativo (que destoa e muda de cara por sistema): a área do preview inteira vira botão, com ícone em pill e legenda no meio, e o clique aciona o input escondido, sobrando só um "Trocar imagem" depois de escolher. Clicar num card abre o mesmo modal em modo edição.
     **Abas sublinhadas é padrão novo (14/09/2026)**, diferente do `.aba` de revisar-contrato.html (pílula preenchida). Usar quando as opções trocam o MESMO conteúdo; a linha aqui é o trilho da aba, não moldura de card.
     Guarda em `assinaturas` (várias linhas, `ativo` = é a padrão, com índice único garantindo no máximo uma). A **primeira criada já nasce padrão**, e o servidor recusa apagar a padrão havendo outra. Substituiu `assinatura_padrao`, que era tabela de linha única (PK booleana com `check(id)`) e por isso não comportava mais de uma.

2. **Editor full-width (`#contrato-editor`)** ocupa a página inteira, no formato do Google Docs: a sidebar de config some (`body.editor-aberto .lateral-config{display:none}`) e o nome do arquivo é editado no **header da página** (`#editor-nome`), com o estado do salvamento logo abaixo. **Não existe botão de salvar** (autosave instantâneo) **nem pré-visualização** (removidos em 14/09/2026). A barra de formatação (`.toolbar-editor`) é só de ícones, estilo Docs/Word: seletor de estilo do bloco, negrito, itálico, alinhamento (4), listas (2) e um menu "Inserir" (campos do casal, tabela de itens, bloco de assinaturas). No celular ela quebra em duas linhas, com estilo e Inserir em cima e os ícones embaixo. Header da página e barra formam um bloco fixo só. Editar um modelo **nunca** altera contratos já gerados — a geração congela um snapshot (ver DESIGN nota abaixo).

> **Snapshot na geração:** ao gerar um contrato, o servidor copia `conteudo_html`/`conteudo_json`/`nome` do modelo padrão para `contratos.template_html_snapshot` / `template_json_snapshot` / `template_nome`. As telas de revisar/assinar e o PDF leem o snapshot; só caem no modelo vivo (via `template_id`) para contratos antigos, gerados antes do snapshot existir.

### Input, select, textarea

Sem borda. Bg `--soft`, radius 8, padding `9px 12px`. `-webkit-appearance:none`. Focus: bg vira `#EEF0F3` (mudança sutil), sem ring. Label 12.5px peso 500 `--ink-soft` acima do campo, gap 6.

### `.contagem`

Chip contador ao lado do h1. `min-width:24px; height:22px; padding:0 8px; radius:999px`, bg `--soft`, texto `--ink-soft`, 12.5px peso 600. Some com `:empty`.

### Ícones

- Sempre Lucide via `data-lucide="nome"`.
- Stroke-width padrão nos SVGs helper: 1.8.
- Ícone dentro de "pill" (kpi-icone, legend-icone, mc-icone): sempre pastel `#EAF1F3` bg + `--accent` cor.
- Ícone em botão: `width:16px; height:16px` alinhado com `gap:8px`.

## Estados de hover (padrão)

Duas paletas de hover para cartões de ação (nunca borda):

- **Sobre fundo branco**: hover `--soft`. Ex: item da home, `.card-link-cliente`.
- **Sobre fundo `--soft` ou pra ações secundárias**: hover `--line` (mais escuro que --soft). Ex: `.btn-copiar-campo`, `.link-voltar`, `.sidebar-aba`, `.btn-editar-secao`, `.btn-icone`, `.btn-colapsar`, `.btn-wpp`.

Nunca box-shadow no focus. Padrão sem outline.

**Sem hover no touch:** um bloco `@media (hover: none)` no fim do CSS zera todos os `:hover` de volta ao repouso em telas sem ponteiro fino (celular/tablet), porque senão o hover "gruda" depois do toque. O feedback no touch fica por conta do `:active`. **Ao criar um hover novo, neutralizá-lo nesse bloco** — senão vai grudar no mobile.

## Skeleton e pull-to-refresh

Toda página de lista (home, pendências, clientes) mostra **skeleton** enquanto os dados carregam: o loader renderiza placeholders `.sk` na hora e só troca pelo conteúdo real quando o fetch volta. O shimmer é lento e sutil de propósito (faixa larga de baixo contraste `--soft → #EEF0F3`, 2.1s ease-in-out, quase uma respiração — charme premium, não um flash) e respeita `prefers-reduced-motion`. No pull-to-refresh o skeleton é **segurado por um mínimo de ~900ms** (`esperaMin` + `Promise.all` com o fetch) pra ele aparecer de verdade em vez de piscar, já que o fetch volta num instante. O skeleton cobre **tudo** da home: saudação (barra shimmer), card de atenção (modo `.carregando` com ícone/textos em shimmer), KPIs e listas.

**Entrada dos componentes (estilo Framer):** quando o conteúdo real entra (primeira carga ou refresh), os blocos fazem um fade + slide-up escalonado via `animarEntrada(ids, seletor)` — remove a classe `.entra`, força reflow e re-aplica com `animation-delay` incremental (65ms por bloco). Suaviza a troca skeleton→conteúdo em vez do corte seco. Keyframe `entra-suave` (`.72s cubic-bezier(.16,.7,.3,1)`, translateY 16px, stagger 90ms/bloco — lento e macio de propósito), respeita `prefers-reduced-motion`. Usado na home (saudação, atenção, KPIs, seções — cascata 0/90/180/270/360ms) e nas pendências (grupos). Cada loader é dividido em `carregar<Pagina>()` (mostra a página + chama o recarregar) e `recarregar<Pagina>()` (skeleton + fetch + desenha) — o segundo é reutilizado pelo pull-to-refresh sem trocar de tela nem mexer no histórico.

**Pull-to-refresh (só no touch):** puxar a lista pra baixo a partir do topo traz a página junto (rubber-band, com resistência) e mostra o `#ptr-spinner` — um pill `#F7F9FA` (mesma cor dos chips internos, sem sombra) com o ring estilo shadcn (`.ptr-ring`, borda `--line` + topo `--accent`) e o texto "Carregando" ao lado. O chip **surge crescendo** (scale .6 → 1) e com fade-in conforme o puxão, e ao passar o limiar dá um **reload de verdade** (`window.location.reload()`, ~320ms depois pra o spinner aparecer) — a URL acompanha a tela, então volta na mesma página. Só ativa em `@media (hover: none)` e no topo da rolagem; o **detalhe fica de fora** (form em edição, um reload perderia o que está sendo digitado). Limiar ~56px de deslocamento (damping .6).

## Toast

`.toast-salvo`. Fixo `bottom:28px; left:50%; translateX(-50%)`, bg `--noir`, texto branco 13.5px peso 500, radius 12, `padding:10px 18px`, sombra `0 12px 30px rgba(0,0,0,.22)`. Fade + slide-up 150ms.

## O que esta área NÃO faz

- Não usa serifada. Só Inter.
- Não usa focus ring. Nem no `<button>`, `<input>`, `<a>` ou custom.
- Não usa borda pra diferenciar seção/estado. `--line` só aparece como bg de hover.
- Não usa travessão em nenhum texto de tela.
- Não usa cor de status verde/amarelo/vermelho como bg do card inteiro. Cor só no chip/badge/ícone; o card permanece branco.
