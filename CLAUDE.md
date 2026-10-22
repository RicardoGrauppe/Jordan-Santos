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
Tiptap (editor de contrato) · jose (cookie de sessão).

## Mapa

```
src/app/entrar               login
src/app/painel/              área logada; layout.tsx checa a sessão: tela nova nasce protegida
  page.tsx                   home (saudação, clima, KPIs, próximos eventos, links)
  clientes/                  lista, [id] (ficha), [id]/contrato (revisão e confirmação)
  pendencias/                rascunhos, aguardando assinatura, confirmados sem contrato
  configuracoes/             perfil, localização, senha; contrato/ (modelos + assinaturas), contrato/[id] (editor)
src/app/cadastro             formulário que o casal preenche (sem AppShell)
src/app/proposta             proposta comercial que o casal lê
src/app/api/                 sessao, config, templates, estudio, orcamento, assinatura (só baixa a via), autentique (webhook)
src/components/              ui.tsx (kit), AppShell.tsx (moldura), ModalConfirmar, ModalAssinatura, EditorContrato, Skeleton
src/lib/                     supabase.ts, sessao.ts, util.ts, painel.ts, contrato-editor.ts, contrato-template.ts,
                             catalogo.ts, ficha.ts, email.ts, autentique.ts, contrato-autentique.ts,
                             contrato-pdf/ (montar.ts, gerar.ts, gerar-pdfmake.ts, fontes)
supabase/migrations/         schema (cópia do original) + contrato_snapshot (colunas que lá só existiam no banco)
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
Enquanto a Autentique responde, o editor mostra uma tela de carregamento; deu certo, volta pra ficha com `?enviado=1` (ou `=atualizado`), e a ficha abre o pop-up de compartilhar (`ModalContratoEnviado`: link, WhatsApp, e-mail, mensagem e "Ver contrato" no painel da Autentique). Esse pop-up só lê o link (`apenasLink`). Depois de enviado, o botão principal é sempre "Abrir na Autentique".

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
  textos de `/proposta`, `NOME_FOTOGRAFO` em `assinar/Assinar.tsx`,
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
