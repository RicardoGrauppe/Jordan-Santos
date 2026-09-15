# estudio-saas

Painel do fotógrafo: clientes, contrato, assinatura eletrônica e entrega.
Primeira versão do SaaS da Nexus Creative Studio.

**Origem:** port do estúdio do Jordan Santos (site em HTML/JS puro, em
produção em jordansantosfotografia.com) para Next.js. O comportamento é o de
lá; a stack é esta. Veja `CLAUDE.md` para as regras do projeto.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase
(PostgREST + Auth, sempre pelo servidor) · Tiptap · pdf-lib e pdfmake · jose.

## Rodar local

```bash
npm install
supabase start          # banco local em Docker (portas 553xx)
npm run dev
```

Copie `.env.local.example` para `.env.local`. Para o banco local, `SUPABASE_URL`
e `SUPABASE_SERVICE_ROLE_KEY` saem de `supabase status -o env`. Deixe
`RESEND_API_KEY` vazia no local: assinar contrato manda e-mail de verdade.

Crie o admin no Auth local (a rota de sessão só aceita `app_metadata.role = "admin"`):

```bash
curl -X POST "http://127.0.0.1:55321/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@estudio.local","password":"troque-isto","email_confirm":true,"app_metadata":{"role":"admin"}}'
```

## Mapa

```
src/app/entrar          login
src/app/painel          área logada (layout.tsx checa a sessão no servidor)
src/app/api             rotas: sessao, config, templates, estudio, orcamento, assinatura
src/app/cadastro        formulário que o casal preenche
src/app/proposta        proposta comercial que o casal lê
src/app/assinar         onde o casal assina o contrato
src/components          kit (ui.tsx), moldura (AppShell), modais, editor de contrato
src/lib                 supabase, sessão, util, editor de contrato, gerador de PDF
supabase/migrations     schema (mesmo do estúdio original)
```

## O que não pode regredir

Está em `CLAUDE.md`, seção "Segurança". Em uma linha: a service role nunca
chega ao browser, falha de login responde sempre igual, trocar senha exige a
senha atual, e o IP da auditoria é `null` quando não dá pra saber, nunca `"?"`.
