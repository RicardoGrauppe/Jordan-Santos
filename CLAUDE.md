# estudio-saas

Painel do fotógrafo, em Next.js. **Port do estúdio do Jordan Santos**
(`03 🏢 - NEXUS CREATIVE STUDIO/Clients/Ativos/Jordan Santos/Website/`), que é a
primeira versão deste produto e a fonte da verdade de comportamento: quando
houver dúvida do que uma tela faz, abra o HTML equivalente lá e siga.

**O projeto original é somente leitura.** Não edite nada dentro da pasta do
Jordan, nem o banco de dados dele.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase
(PostgREST + Auth via service role, sempre no servidor) · lucide-react ·
Tiptap (editor de contrato) · Puck 0.23, fixado (editor de blocos do Ateliê) · jose (cookie de sessão).

## Mapa

```
src/app/page.tsx             a raiz é o SITE do fotógrafo (modelo do Ateliê no ar); o painel entra por /painel ou /entrar
src/app/entrar               login
src/app/painel/              área logada; layout.tsx checa a sessão: tela nova nasce protegida
  page.tsx                   home (saudação, clima, KPIs, próximos eventos, links)
  clientes/                  lista, [id] (ficha), [id]/contrato (revisão e confirmação)
  pendencias/                rascunhos, aguardando assinatura, confirmados sem contrato
  configuracoes/             perfil, localização, senha; contrato/ (modelos + assinaturas), contrato/[id] (editor)
  atelie/                    galeria dos modelos de site (pôr no ar, duplicar, renomear, apagar); [id] (editor, tela cheia)
src/app/cadastro             formulário que o casal preenche (sem AppShell)
src/app/proposta             mesmo site da raiz, mantido pra não quebrar link já enviado
src/app/atelie/previa/[id]   prévia do RASCUNHO (ou ?versao=) de um modelo, só logado (404 pros outros); ?barra=1 põe a barra da prévia
src/app/atelie/secao/[tipo]  uma seção pronta sozinha, com conteúdo de exemplo: a prévia dos cartões da biblioteca de seções; só logado
src/app/midia/[caminho]      entrega as fotos do Ateliê (do Storage) pro site; pública, nome sorteado
src/app/api/                 sessao, config, templates, estudio, orcamento, assinatura (só baixa a via), autentique (webhook), atelie
src/components/              ui.tsx (kit), AppShell.tsx (moldura), ModalConfirmar, ModalAssinatura, EditorContrato, EditorAtelie, SecoesProntas, CamposAtelie (foto, biblioteca, foco), VersoesAtelie, BarraDaPrevia, Skeleton
src/lib/                     supabase.ts, storage.ts, sessao.ts, util.ts, painel.ts, contrato-editor.ts, contrato-template.ts,
                             catalogo.ts, ficha.ts, email.ts, autentique.ts, contrato-autentique.ts,
                             contrato-pdf/ (montar.ts, gerar.ts, gerar-pdfmake.ts, fontes),
                             atelie/ (blocos.tsx, tipos.ts, proposta-css.ts, modelo-inicial.ts, modelo-guiado.ts, modelos.ts, midias.ts, PaginaDoSite.tsx, dicionario.ts)
supabase/migrations/         schema (cópia do original) + contrato_snapshot (colunas que lá só existiam no banco) + atelie (site_modelos) + atelie_midias (site_midias) + atelie_versoes (site_versoes)
```

## Dependências travadas

- **pdfmake fica na 0.2.x.** `contrato-pdf/gerar-pdfmake.ts` veio do original e usa
  `new PdfPrinter(fontes).createPdfKitDocument(...)`. A 0.3 mudou a API inteira
  (exporta uma instância, sem construtor) e a assinatura do casal quebra com
  502 "is not a constructor". Subir de major = reescrever o gerador.
- `next.config.ts` mantém `pdfmake` e `pdf-lib` em `serverExternalPackages` e
  inclui `contrato-pdf/**` no tracing: sem isso o deploy sobe sem as fontes.

## Responsivo: sempre mobile-first

Nunca use as variantes `max-*` do Tailwind (`max-md:`, `max-[520px]:`). Elas
compilam pra `@media not (min-width: …)`, sintaxe de Media Queries nível 4 que
o Safari só entende do 16.4 pra cima — quem não entende **descarta a regra
inteira**. O minificador do build reescreve pra `not all and (…)`, então o
defeito só aparece no servidor de DESENVOLVIMENTO, que é justamente onde o
Jordan e o Ricardo testam no iPhone.

Escreva o estado do celular como padrão e devolva no `md:`
(`hidden md:block`, `text-[25px] md:text-[32px]`): isso só gera
`@media (min-width: …)`. Ao inverter, cuidado com `display`: `hidden` e
`inline-flex` na mesma lista brigam, e quem vence é a ordem do arquivo gerado,
não a que você digitou. Deixe só `hidden` + `md:inline-flex`.

## Banco local

Sempre o Supabase local em Docker (`supabase start`, portas 553xx), nunca o
banco do Jordan. `supabase/migrations/` é a verdade do schema: coluna nova
entra como migração, nunca por `alter table` solto no psql.

O Storage local precisa estar ligado (`[storage] enabled = true` no
`supabase/config.toml`): as fotos do Ateliê moram lá, no bucket privado
`atelie`, que o app cria sozinho na primeira foto enviada.

## Assinatura: Autentique (desde 21/10/2026)

A tela própria (`/assinar`) **não existe mais**. Quem coleta assinatura é a
Autentique, pela API GraphQL v2, com a chave da conta do **próprio fotógrafo**
(é o nome dela que o casal vê no pedido).

Caminho: "Abrir rascunho do contrato" leva pra tela de edição
(`/painel/clientes/[id]/contrato/editar`), que edita a cópia do texto daquele
contrato (`template_json_snapshot`, salva sozinha) com os campos fixos do casal
e do pacote. Um clique em **"Assinar e enviar"** monta o PDF **sem a nossa
folha de comprovante**, sobe pra Autentique com dois signatários em ordem
(`sortable`), assina pelo dono da chave (`signDocument`, que não gera e-mail
pra ele) e devolve o link curto do casal, que o fotógrafo manda por WhatsApp.
Não existe mais assinatura do fotógrafo dentro do app: o clique é a assinatura.
Depois de enviado, o botão principal é sempre "Abrir na Autentique".

**Editar depois de enviado = documento novo.** A Autentique não troca o
arquivo de um documento (`updateDocument` só mexe em nome/mensagem), então
"Atualizar na Autentique" apaga o documento de lá e cria outro: o link do casal
muda e gasta 1 da cota de 10/mês. Por isso a tela pede confirmação. Quem diz se
houve mudança é `autentique_hash` (sha256 do texto + dados do casal no envio),
calculado só no servidor. Contrato de texto fixo antigo (sem
`template_json_snapshot`) não é editável e cai na revisão antiga
(`rotaDaRevisaoAntiga`).

**Entrega é por LINK (`DELIVERY_METHOD_LINK`), e isso não é detalhe.** Medido
em 22/10/2026, no primeiro envio real: no modo e-mail (o padrão) a Autentique
não manda link nenhum na resposta (`link: null` pros dois) e o painel fica sem
nada pra copiar, que foi o erro "a Autentique ainda não devolveu o link". No
modo link ela devolve o `short_link` e **não manda e-mail**: quem entrega o
contrato é o fotógrafo. O link segue amarrado ao e-mail do signatário, que
confirma identidade pra assinar, então mandar por WhatsApp não afrouxa nada.

O estado continua nas colunas de sempre (`status`, `visualizado_em`,
`assinado_em`, `pdf_base64`): `lib/contrato-autentique.ts` traduz o que vem de
lá. Dois caminhos trazem a novidade, e os dois terminam na mesma função:
`acao: "sincronizar-contrato"` (o painel chama ao abrir ficha e revisão) e o
webhook em `/api/autentique`, que só entra em serviço quando houver endereço
público. Recusa cai em `status: cancelado` + `recusado_em`, porque o CHECK da
tabela não tem "recusado".

Cancelar no painel **apaga o documento na Autentique**, senão o link curto
seguiria de pé e um contrato cancelado aqui voltaria assinado de lá.

O PDF assinado é baixado uma vez e guardado em `pdf_base64`: o painel não
depende da Autentique estar no ar pra entregar a via.

## Ateliê: o site do fotógrafo, montado com blocos

O fotógrafo monta **modelos de site** (uma página longa cada) com os blocos de
`lib/atelie/blocos.tsx`, no editor Puck. Um modelo fica no ar (chave
`site_ativo` em `config`) e o público vê a versão **publicada** dele
(`site_modelos.publicado`); o `rascunho` nunca aparece pra quem abre o link.

- **Os blocos são a proposta do Jordan cortada em pedaços**, com o mesmo HTML
  e o CSS de `proposta-css.ts`. Mudou um bloco? Meça pelo DOM em 1440px e no
  celular contra o que estava antes: a régua é "igual ao original".
- **O site nunca cai por causa do banco.** Falha de leitura, nada no ar ou
  modelo nunca publicado: `siteNoAr()` devolve o `MODELO_INICIAL`.
- **Contato do estúdio é campo da página** (raiz do Puck), não de bloco, e
  chega à chamada e ao rodapé pelo `metadata`. Trocar o número é num lugar só.
- Nada de hook ou contexto dentro de bloco: o mesmo config roda no editor
  (cliente) e no `<Render>` (servidor).
- No editor a página fica num iframe, então a animação de entrada é
  desligada lá (`.editando`).
- **Editor = a tela original do Puck, do jeito que ele vem** (decisão do
  Ricardo Grauppe, 22/10/2026, depois de comparar com uma moldura própria
  que deixava coisa do Puck de fora): `components/EditorAtelie.tsx` é só o
  `<Puck>` com o config, os textos em português (`lib/atelie/dicionario.ts`)
  e o Publicar dele ligado à nossa publicação, mais dois acréscimos: a seta
  de voltar no quadrado vazio do canto esquerdo do cabeçalho (override
  `header`) e o botão "Seções prontas" antes do Publicar (`headerActions`),
  ambos com o `Button`/`IconButton` do Puck. Sem pele da
  casa, tamanhos de tela nem permissões próprias, então no celular também se
  monta a página (decisão do Ricardo, 22/10/2026); estilo fica pra depois. Nome,
  prévia, versões e descartar moram no menu do cartão, na galeria. Importe
  sempre `no-external.css`: o CSS padrão puxa a Inter de um servidor de fora.
- **Blocos genéricos** (Título e texto, Foto com texto, Galeria, Espaço)
  falam a língua da proposta, não a do painel (brandbook, seção 22), com CSS
  próprio (`bl-*`, `fundo-*`) no fim de `proposta-css.ts`, mobile-first.
  Separar bloco de bloco é por fundo (branco, claro, escuro), nunca borda.
- **Link que vem de campo passa por `linkSeguro`**: só http(s), mailto, tel,
  # ou caminho do site. A página é pública, e um `javascript:` colado num
  campo viraria script rodando no celular do casal.
- Bloco novo entra em dois lugares: `tipos.ts` (a API valida contra ela) e
  `configAtelie`. Se os dois divergirem, o build quebra.
- **Seções prontas** (`SECOES`, no fim de `blocos.tsx`; nomes em
  `TIPOS_DE_SECAO`): blocos que carregam outros num slot (`blocos`), que já
  entra preenchido, no desenho do bloco "Template" da demo do Puck. Os
  blocos de dentro usam o `defaultProps` de cada um e vão sem id (o Puck dá
  na hora de inserir). Dentro de seção não entra outra seção, e a API
  confere os dois níveis. Na lista do editor elas vêm antes dos blocos
  (`categories`), mas o caminho principal é o botão "Seções prontas" do
  cabeçalho (`SecoesProntas.tsx`, override `headerActions`): biblioteca no
  desenho da do Elementor, com prévia de verdade de cada seção e clique pra
  inserir logo depois do bloco selecionado. Arrastar da lista sozinho não
  dizia o que aqueles nomes eram (Ricardo, 22/10/2026). Seção nova precisa
  de uma linha em `DESCRICAO_SECAO`. Texto de exemplo novo de seção entra em
  `EXEMPLO`. Todo bloco entra pronto:
  o `defaultProps` usa o conteúdo de exemplo de `EXEMPLO` (modelo-guiado.ts),
  nunca entra vazio nem com conteúdo de um estúdio de verdade.
- **Foto nunca é endereço digitado.** Campo de foto abre a biblioteca
  (`CamposAtelie.tsx`); a foto é reduzida no navegador (2560px) antes de
  subir e vai pro bloco como `/midia/<uuid>.jpg`. Nunca a URL do Storage:
  ela aponta pra 127.0.0.1 e quebra no celular da rede local. Foto em uso num
  modelo não se apaga.
- **Foco só onde a foto é cortada** (grade do "Texto com fotos", faixa dos
  "Cartões"). Nos blocos de foto em altura natural o `foco` segue no dado e
  no style, mas o campo fica escondido (`visible: false`): lá ele não muda
  nada.
- **Beta:** a galeria mostra selo "Beta" e um aviso âmbar enquanto o Ateliê
  está em teste (decisão do Ricardo, 22/10/2026). Saem juntos.
- **Modelo novo nasce guiado** (`modelo-guiado.ts`): blocos que explicam, no
  próprio texto, como o Ateliê funciona. Texto de exemplo novo entra no
  objeto `T` de lá, que é a lista que a confirmação de publicar confere
  (`temExemplo`) pra avisar que ele iria pro ar. Bloco novo e modelo guiado
  usam as fotos de exemplo desenhadas (`public/img/atelie/exemplo-*.svg`,
  `FOTO_DE_EXEMPLO`), nunca foto de um estúdio de verdade; elas também
  contam como exemplo no aviso.
- **Toda publicação vira uma versão** (`site_versoes`, as 30 últimas por
  modelo). Restaurar leva a versão pro RASCUNHO e nunca publica sozinho;
  descartar faz o rascunho voltar ao publicado. Os dois ficam na galeria,
  porque o Puck não aceita trocar os dados por fora com o editor aberto.
- **"Pôr no ar" publica o modelo do jeito que ele está** (rascunho vira
  publicado) e troca o site na hora, por isso confirma. Modelo sem bloco não
  vai pro ar e o modelo no ar não se apaga: as duas coisas deixariam o site
  em branco.

## Dívidas conhecidas

- **Multi-tenant fica pra DEPOIS, por decisão do Ricardo (2026-09-16).** A
  ordem é: primeiro este app fica pronto e alinhado pro Jordan, que vai ser o
  único usuário; só então vira SaaS de vários fotógrafos. Ou seja, **não saia
  generalizando nada por conta própria**: enquanto isso, o que é do Jordan pode
  continuar fixo no código, e o trabalho é deixar a experiência dele redonda.

  O estado de hoje, pra quando a hora chegar: nenhuma tabela tem dono
  (`clientes`, `contratos`, `contrato_templates`, `assinaturas`, `config`),
  tudo assume um fotógrafo só. O tipo `Sessao` já carrega `workspace`, mas
  nenhuma consulta filtra por ele. Quando for fazer, é aqui que dói: toda
  consulta em `/api` passa a filtrar e `config` (chave/valor global) vira
  config por fotógrafo. A janela barata pra isso é a migração do banco pro
  Supabase do Ricardo, porque o volume é pequeno (4 clientes e 4 contratos).
- **Nome e marca do fotógrafo ainda são do Jordan** em pontos fixos: logo e
  textos do modelo inicial do Ateliê (`lib/atelie/modelo-inicial.ts`), `NOME_FOTOGRAFO` em `assinar/Assinar.tsx`,
  `NOME_FOTOGRAFO_PADRAO` e a legenda "CONTRATADA" em `clientes/[id]/contrato`,
  saudação do WhatsApp em `api/estudio`, remetente e `DESTINO_JORDAN` em
  `lib/email.ts`, e-mails de `api/orcamento`, e as imagens em `public/img/`.
  Tudo isso precisa sair de `config` (perfil) quando houver mais de um estúdio.
- E-mail: com `RESEND_API_KEY` vazia todo envio falha e vai pro `console.error`,
  mas nada trava: cadastro do casal e assinatura gravam e respondem `ok` do
  mesmo jeito (best-effort nos dois). Sem domínio verificado no Resend, só o
  dono da conta recebe.

## Regras visuais, que não se quebram

Vieram do estúdio original e cada uma custou tempo pra descobrir:

1. **Nenhuma borda pra separar ou marcar estado.** Nunca. Separação é fundo
   diferente mais sombra (`shadow-card`) ou diferença de tom entre `paper`,
   `soft` e `line`. Antes de escrever `border`, resolva com tom ou sombra.
   O editor do Ateliê fica fora destas regras por enquanto: é a tela
   original do Puck, sem pele da casa (decisão do Ricardo, 22/10/2026).
2. **Nenhum anel de foco colorido.** Foco muda o fundo, sutil.
3. **Hover só onde existe mouse.** Sempre `[@media(hover:hover)]:hover:…`. Sem
   isso, no celular o estado fica preso depois do toque e não volta.
4. **Ícone em pill sempre inline** com o título, nunca acima.
5. Raio generoso: botão e campo 10px, card 16 a 18px. Selo de status 6px (sutilmente quadrado, ver brandbook "Selos de status"); pill de filtro 999px.

## Regras de texto (tom de voz)

1. **Nunca usar travessão (—)** em texto que aparece na tela. Vírgula,
   parênteses ou reescreva. Em comentário de código pode.
2. Duas vozes: no painel, "você" é o fotógrafo. Em tela que o **cliente dele**
   abre (proposta, assinatura, formulário), a fala é em primeira pessoa do
   plural, como o próprio estúdio falando: "Recebemos sua solicitação", nunca
   "Fulano Fotografia recebeu".
3. Nomeie pelo que a pessoa reconhece, não pelo que o sistema faz por dentro.

## Segurança, o que não pode regredir

- `src/lib/supabase.ts` tem `import "server-only"`: a service role nunca chega
  ao browser, e o build quebra se alguém importar de um Client Component.
- Falha de login responde **sempre igual** (mesma mensagem, status e espera),
  senão a rota vira uma forma de descobrir quem tem conta.
- Troca de senha exige a senha **atual**, além do cookie: sessão roubada não
  pode trancar o dono pra fora.
- O IP da trilha de auditoria da assinatura é `null` quando não dá pra saber,
  nunca `"?"`: o contrato afirma que ele fica registrado, e campo vazio é
  honesto enquanto um valor inventado não é.
- O `Secure` do cookie de sessão acompanha a **conexão**, não o `NODE_ENV`
  (`lib/sessao.ts`). Não troque de volta achando que afrouxa: em produção, que
  é https, o cookie continua `Secure`. O que isso conserta é o build de
  produção servido por http pra testar no celular, onde o navegador descarta em
  silêncio um cookie `Secure` e o login parece recusar a senha certa.
