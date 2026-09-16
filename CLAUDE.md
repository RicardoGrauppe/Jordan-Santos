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
src/app/assinar              onde o casal assina (?token=…)
src/app/api/                 sessao, config, templates, estudio, orcamento, assinatura
src/components/              ui.tsx (kit), AppShell.tsx (moldura), ModalConfirmar, ModalAssinatura, EditorContrato, Skeleton
src/lib/                     supabase.ts, sessao.ts, util.ts, painel.ts, contrato-editor.ts, contrato-template.ts,
                             catalogo.ts, ficha.ts, email.ts, contrato-pdf/ (gerar.js, gerar-pdfmake.js, fontes)
supabase/migrations/         schema (cópia do original) + contrato_snapshot (colunas que lá só existiam no banco)
```

## Dependências travadas

- **pdfmake fica na 0.2.x.** `contrato-pdf/gerar-pdfmake.js` veio do original e usa
  `new PdfPrinter(fontes).createPdfKitDocument(...)`. A 0.3 mudou a API inteira
  (exporta uma instância, sem construtor) e a assinatura do casal quebra com
  502 "is not a constructor". Subir de major = reescrever o gerador.
- `next.config.ts` mantém `pdfmake` e `pdf-lib` em `serverExternalPackages` e
  inclui `contrato-pdf/**` no tracing: sem isso o deploy sobe sem as fontes.

## Banco local

Sempre o Supabase local em Docker (`supabase start`, portas 553xx), nunca o
banco do Jordan. `supabase/migrations/` é a verdade do schema: coluna nova
entra como migração, nunca por `alter table` solto no psql.

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
5. Raio generoso: botão e campo 10px, card 16 a 18px, selo 999px.

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
