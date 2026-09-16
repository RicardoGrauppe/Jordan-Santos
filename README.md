# estudio-saas

Painel do fotógrafo: clientes, contrato, assinatura eletrônica e entrega do
documento. Primeira versão do SaaS da Nexus Creative Studio.

**Origem:** port do estúdio do Jordan Santos (site em HTML e JS puro, em
produção) para Next.js. O comportamento é o de lá; a stack é esta. As regras do
projeto estão no `CLAUDE.md`, o sistema visual no `DESIGN.md` e a voz das telas
no `TOM-DE-VOZ.md`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase
(PostgREST e Auth, sempre pelo servidor) · Tiptap · pdf-lib e pdfmake · jose.

## Rodar local

```bash
npm install
supabase start          # banco local em Docker (portas 553xx)
npm run dev             # http://localhost:3100
```

Copie `.env.local.example` para `.env.local`. Para o banco local, `SUPABASE_URL`
e `SUPABASE_SERVICE_ROLE_KEY` saem de `supabase status -o env`. Deixe
`RESEND_API_KEY` vazia no local: assinar contrato dispara e-mail de verdade.

Crie o admin no Auth local (a rota de sessão só aceita `app_metadata.role = "admin"`):

```bash
curl -X POST "http://127.0.0.1:55321/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@estudio.local","password":"troque-isto","email_confirm":true,"app_metadata":{"role":"admin"}}'
```

Num banco novo de verdade, o mesmo vale pelo painel do Supabase
(Authentication → Users → Add user, com auto-confirm) mais:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'e-mail-do-fotografo';
```

## Variáveis de ambiente

| Var | O que é |
|---|---|
| `SUPABASE_URL` | Project URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role; só o servidor lê, nunca vai pro browser |
| `SESSION_SECRET` | opcional: segredo do cookie de sessão (`openssl rand -hex 32`). Sem ela, deriva da service role |
| `RESEND_API_KEY` | chave do Resend (aviso de cliente novo e via assinada por e-mail) |
| `ADMIN_EMAIL` | opcional: e-mail tratado como admin, além do `app_metadata.role` |

## Mapa

```
src/app/entrar                  login
src/app/painel                  área logada; layout.tsx checa a sessão no servidor
  page.tsx                      home (saudação, clima, KPIs, próximos eventos, links)
  clientes/                     lista, [id] (ficha), [id]/contrato (revisão e confirmação)
  pendencias/                   precisa de atenção
  tempo/                        previsão detalhada
  configuracoes/                perfil, localização, senha, modelos e assinaturas
src/app/cadastro                formulário que o casal preenche
src/app/proposta                proposta comercial que o casal lê
src/app/assinar                 onde o casal assina o contrato (?token=…)
src/app/api                     sessao, config, templates, estudio, orcamento, assinatura
src/components                  kit (ui.tsx), moldura (AppShell), modais, editor de contrato
src/lib                         supabase, sessão, util, editor e template de contrato, gerador de PDF
supabase/migrations             schema (o mesmo do estúdio original) e as migrações seguintes
tools/contrato-template         ferramenta local que regera o template PDF legado
```

## Fluxo, ponta a ponta

1. O casal preenche `/cadastro`. O `/api/orcamento` cria a ficha do cliente
   (status "novo") e avisa o fotógrafo por e-mail.
2. No painel, o fotógrafo abre a ficha, escolhe pacote e adicionais, ajusta
   total e entrada.
3. Gera o contrato: o servidor congela um **snapshot** do modelo padrão dentro
   do contrato e cria um token de 32 bytes.
4. Confirma com a assinatura dele. O contrato passa a "enviado" e o link fica
   pronto pra mandar no WhatsApp do casal.
5. O casal abre `/assinar?token=…`, lê o documento inteiro, preenche nome e CPF,
   aceita os termos e assina. O servidor monta o PDF, grava a trilha de
   auditoria e manda a via assinada pras duas partes.

## Assinatura eletrônica: validade jurídica

Assinatura eletrônica simples, válida entre as partes (MP 2.200-2/2001 art. 10
§2º; Código Civil arts. 107 e 219). **Não** tem a presunção automática da
qualificada (ICP-Brasil): se contestada, o ônus de provar é de quem apresenta, e
é pra isso que serve a trilha gravada na tabela `contratos`: aceite expresso com
texto e carimbo de tempo, nome e CPF do signatário, IP e user-agent capturados
no servidor, hash SHA-256 do PDF, o snapshot do que foi enviado, e uma página de
auditoria anexada ao próprio PDF.

O fotógrafo **consegue ver essa trilha** na tela de revisão do contrato, com
botão de copiar. Isso não é enfeite: o texto do contrato afirma que IP,
dispositivo e hash ficam preservados no sistema do fotógrafo. Se o dado não foi
capturado, a tela diz "não registrado" em vez de inventar um valor.

**O fator de verificação é a posse do link** (token de 32 bytes, entregue pelo
fotógrafo direto no WhatsApp do casal). O OTP por e-mail foi removido no
original em 2026-07-25, quando ficou claro que sem domínio verificado o código
nunca chegaria ao casal. Foi descartada a ideia de mandar o código junto na
mensagem: quem entrega passaria a conhecer o código, então ele não provaria
autoria nenhuma e a página de auditoria estaria afirmando algo falso. Com
domínio verificado, vale reintroduzir o OTP: é ele que aproxima a assinatura da
modalidade "avançada".

O PDF assinado fica em `contratos.pdf_base64`, imutável. O token expira em 30
dias, vira somente leitura depois de assinado, e cancelar invalida.

## E-mail

Todo envio é best-effort, com `try/catch` em volta: `RESEND_API_KEY` vazia
derruba só o aviso, nunca a operação. O casal continua sendo cadastrado e o
contrato continua sendo assinado.

Sem domínio verificado no Resend, a entrega só acontece pro e-mail dono da
conta. Pra destravar: registrar o domínio, cadastrar em resend.com/domains,
publicar SPF e DKIM, e trocar a constante `REMETENTE` em `src/lib/email.ts`.
A via assinada vai em envios **separados** pras duas partes de propósito: num
`to` só, o Resend recusa a requisição inteira se um destinatário for barrado, e
nem o fotógrafo receberia.

## Decisões que não se desfazem sem entender

- **O PDF é montado no servidor.** Antes a tela era fotografada com
  html2pdf/html2canvas: ~2,9 MB de imagem por contrato, sem texto selecionável,
  serrilhado no zoom, quebra de página por pixel e resultado diferente conforme
  o aparelho do casal. Hoje o browser manda só o PNG da assinatura (~15 KB) e o
  servidor monta o documento.
- **Dois caminhos de PDF.** Contrato **com modelo** (o normal) vai pelo
  `gerar-pdfmake.ts`, que monta o PDF do zero a partir do JSON do Tiptap.
  Contrato **sem modelo** (antigo, de antes dos modelos) vai pelo `gerar.ts`,
  que preenche as lacunas de um template vetorial com pdf-lib. O template não é
  escrito à mão: sai do `src/lib/contrato-template.ts` via
  `npm run contrato:regerar`, e `npm run contrato:verificar` acusa quando os
  dois saíram de sincronia.
- **pdfmake fica na 0.2.x.** A 0.3 trocou a API (deixou de exportar a classe
  `PdfPrinter`) e derruba a assinatura do casal com 502. Subir de major exige
  reescrever o gerador.
- **Editar um modelo nunca muda contrato já gerado.** A geração congela
  `conteudo_html`, `conteudo_json` e `nome` dentro do contrato. Telas e PDF leem
  o snapshot; só caem no modelo vivo pra contratos antigos.
- **A tabela do contrato lista os itens sem preço unitário**, só o valor total
  no rodapé. Imprimir o preço de tabela de cada item ao lado de um total
  diferente levantaria a pergunta "de onde vem a diferença?", que é justamente o
  que se quer omitir.
- **Ficha: digitou, salvou.** Sem lápis pra destravar e sem botão de salvar.
  Autosave com 700ms de pausa; sair do campo ou mexer no pacote grava na hora. O
  estado ao lado diz "Salvando…" / "Salvo" e **não some sozinho**, senão a
  dúvida volta. Ficha nova só vira registro depois que existir um nome, pra um
  clique errado em "Novo cliente" não deixar linha órfã.
- **A única trava de edição é a do contrato confirmado.** Depois da assinatura
  do fotógrafo, pacote, adicionais, total e entrada param de aceitar mudança.
  Quem garante é o `/api/estudio`, que descarta esses campos no PATCH: só CSS
  não bastava, porque `pointer-events` não impede foco por Tab nem o clique no
  `<label>`, e com autosave isso iria pro banco em silêncio.
- **Basta o nome de um dos contratantes, e o CPF é opcional** em toda parte. Há
  cliente sem CPF, e exigir travaria o cadastro dele. Quando vier, tem que estar
  completo: meio CPF no contrato é pior que nenhum. Sem CPF, o PDF omite a
  lacuna em vez de imprimir um traço solto.
- **Sem CPF, o `/api/orcamento` procura a ficha por nome mais data do evento.**
  É mais frágil (erro de digitação no reenvio cria ficha nova), mas duplicar é o
  jeito seguro de falhar. O perigoso seria casar fichas que não são a mesma. O
  CPF ausente é gravado como `null`, não `''`: no Postgres o índice único é
  `NULLS DISTINCT`, então dois clientes sem CPF na mesma data não colidem.
- **Gerar e assinar não exige ficha completa.** O fotógrafo fecha com o que tem
  em mãos e completa depois; o que falta aparece como aviso dentro da
  confirmação. Quem assina digita o próprio nome e CPF na hora.
- **`doc_sha256` é o SHA-256 dos bytes do PDF**, então um `shasum -a 256` no
  arquivo baixado bate com o valor do banco.
- **Catálogo de produtos é fonte única** em `src/lib/catalogo.ts` (id, nome,
  preço), pra o rótulo não divergir entre a proposta e o contrato.

## O que não pode regredir

Está em `CLAUDE.md`, seção "Segurança". Em uma linha: a service role nunca chega
ao browser, falha de login responde sempre igual, trocar senha exige a senha
atual, e o IP da auditoria é `null` quando não dá pra saber, nunca `"?"`.
