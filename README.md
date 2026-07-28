# Site Jordan Santos Fotografia

Site do fotógrafo Jordan Santos: portfólio + calculadora de orçamento (público), painel do estúdio (Jordan) e assinatura eletrônica de contrato dentro da plataforma.

Produção: https://jordan-santos.vercel.app (deploy automático a cada push na `main`).

Site estático, sem build: HTML/CSS/JS vanilla, um arquivo por página. Bibliotecas via CDN: `html2pdf.js` + `signature_pad` (assinar.html) e `intl-tel-input` (orcamento.html, campo de WhatsApp com DDI por país). Os dados vivem no **Supabase** (Postgres), acessado só pelas Vercel Functions com a service role key.

## Estrutura

```
index.html               Portfólio + calculadora de orçamento (página inicial)
orcamento.html           Formulário de fechamento (/orcamento) — exige seleção vinda do index
contrato-template.js     FONTE ÚNICA do texto do contrato, usada por assinar e revisar-contrato
estudio.html             Painel do Jordan (/estudio): clientes + gerar contrato
revisar-contrato.html    Revisão/"assinatura" do Jordan antes de liberar (/revisar-contrato?id=…), admin-only
assinar.html             Assinatura pública do contrato (/assinar?token=…) — signature_pad + html2pdf
catalogo.js              FONTE ÚNICA dos produtos (id → grupo/preço/nome/curto), usada por index e estudio

api/sessao.js            Login/logout do estúdio (admin, sobre o Supabase Auth)
api/estudio.js           CRUD de clientes + gerar/cancelar contrato p/ assinatura
api/orcamento.js         Público: orçamento do site → cria o CLIENTE direto
api/assinatura.js        Público: obter/assinar/baixar o contrato (link tokenizado)
api/_lib/                Helpers compartilhados: supabase, sessao, email, util (não viram functions)

supabase/schema.sql               DDL completo (setup do zero)
supabase/migracao-*.sql           Migrações para banco já existente (contratos, config)
vercel.json              cleanUrls (URLs sem .html)
```

## Fluxo completo (ponta a ponta)

Sem estágio de prospecção (decisão de 2026-07-24): o link do site geralmente só é mandado **depois de uma reunião**, pra quem já quer fechar — então o formulário público já pede tudo que o contrato precisa.

1. **Orçamento** (`/`): o casal escolhe pacote (Eternal/Heritage) + adicionais/álbum/pré-wedding e o CTA **"Enviar nossa data"** guarda os ids escolhidos no `sessionStorage` (`JSF_ORCAMENTO`) e leva pra **`/orcamento`** (`orcamento.html`), o formulário completo (nome + CPF dos dois, WhatsApp, e-mail, endereço com autocomplete de CEP via ViaCEP, data/horário/local do evento). Só os **ids** viajam entre as páginas — nome e preço são reconstruídos do `catalogo.js`. Quem abre `/orcamento` sem seleção é mandado de volta pra `/`. Era um modal dentro do index até 2026-07-28; virou página porque, como overlay de ~1.780px no celular, a rolagem vazava pra home atrás e o botão voltar saía do site. Isso cria o **CLIENTE** direto (`/api/orcamento`, upsert por `cpf_noivo+data_evento`), com os itens e o total salvos. Preços e nomes vêm do `catalogo.js`. O Jordan recebe um e-mail (template com a paleta da marca) avisando do cliente novo.
2. **Ficha do cliente** (`/estudio`): o Jordan confere/completa os dados e ajusta o pacote/adicionais no seletor. Clica em **"Gerar contrato"** (ícone no topo ou botão dentro do fieldset "Contrato") → valida os campos obrigatórios, salva, gera o contrato (status `rascunho`, já salvo mesmo sem assinatura nenhuma) e abre em outra aba a página de revisão.
3. **Revisão do Jordan** (`/revisar-contrato?id=…`, admin-only): ele confere o contrato inteiro e confirma com uma assinatura (cursiva com o nome, padrão, ou desenhada na mão) — isso não manda nada ao casal, só libera o botão **"Pegar link pro cliente"** de volta no `/estudio`, que marca o contrato como enviado e abre um modal com o link + a mensagem pronta pra copiar ou abrir direto na conversa do WhatsApp. O mesmo botão recupera o link depois ("Ver link de novo"), sem gerar contrato novo.
4. **Assinatura do casal** (`/assinar?token=…`): o casal revisa o contrato (já com a assinatura do Jordan deste contrato específico), preenche nome + CPF, marca o aceite e assina de um dos **dois jeitos** (mesma escolha que o Jordan tem na revisão): o nome em cursiva (padrão, desenhado num canvas com a fonte Dancing Script) ou o traço na mão (`signature_pad`). O PDF é gerado no navegador (`html2pdf`), guardado e enviado pras partes (`/api/assinatura`). Depois de assinar, o casal tem um botão pra **baixar a via em PDF** — na hora, direto da memória da aba, e também quando voltar no link depois (aí busca em `GET /api/assinatura?token=…&pdf=1`).

O contrato é FIXO (fonte única em `contrato-template.js`), com os dados do casal preenchidos a partir do backend. A **assinatura do Jordan** é a que ele faz na revisão de cada contrato (`contratos.jordan_assinatura_dataurl`), lida server-side e injetada no contrato do casal — funciona em qualquer dispositivo. A página `/configuracoes`, que guardava uma assinatura padrão na tabela `config`, foi removida em 2026-07-28; o valor antigo segue no banco só como fallback e nada mais o escreve.

## Painel do Jordan (`/estudio`)

Login **e-mail + senha via Supabase Auth** (a senha vive hasheada no Supabase, nunca aqui). Só admin entra: o usuário do Auth precisa de `app_metadata.role = "admin"` (ou casar com a env `ADMIN_EMAIL`). Sessão própria em cookie HMAC-SHA256 (`HttpOnly; Secure; SameSite=Lax`, 7 dias), sem tabela de sessões. Mitigações: espera ~800ms + erro genérico em falha de login, throttle por IP, RLS ligado sem policies (anon key não faz nada). O menu do avatar tem só **Sair**.

## Assinatura eletrônica — validade jurídica

Assinatura eletrônica simples, válida entre as partes (MP 2.200-2/2001 art. 10 §2º; Código Civil arts. 107 e 219; STJ reconhece assinatura sem ICP). **Não** tem a presunção automática da qualificada (ICP-Brasil) — se contestada, o ônus de provar é de quem apresenta, e é pra isso que serve a trilha de auditoria da tabela `contratos`: aceite expresso (texto + timestamp), nome + CPF do signatário, IP + user-agent (capturados no servidor), carimbo de tempo, hash SHA-256 do PDF, snapshot do que foi enviado, e uma **página de auditoria** anexada ao PDF. O PDF assinado fica em `contratos.pdf_base64` (imutável). Token de 32 bytes é a credencial do link (expira em 30 dias; vira read-only após assinado; cancelar invalida).

**O fator de verificação é a posse do link** (token de 32 bytes aleatórios, entregue pelo Jordan direto no WhatsApp do casal). O **OTP por e-mail foi removido em 2026-07-25**: o estúdio não tem domínio, então o código nunca chegaria ao casal (ver abaixo). Foi descartada a alternativa de mandar o código junto na mensagem do WhatsApp — quem entrega passaria a conhecer o código, então ele não provaria autoria nenhuma e a página de auditoria estaria afirmando algo falso. Com domínio verificado, vale reintroduzir o OTP: ele é o que aproxima a assinatura da modalidade "avançada".

⚠️ **E-mail só chega pro próprio Jordan.** O domínio `jordansantosfotografia.com.br` **não existe** (não registrado — verificado no registro.br em 2026-07-25), e sem domínio verificado o Resend só entrega pro e-mail dono da conta. Por isso o link do contrato vai por WhatsApp e a via assinada do casal é best-effort (o envio é feito em chamadas separadas justamente pra que a via do Jordan não falhe junto). Pra destravar: registrar o domínio, cadastrar em resend.com/domains, publicar SPF/DKIM e trocar `REMETENTE` em `api/_lib/email.js`.

## Setup do Supabase

**Banco novo:** SQL Editor → rodar `supabase/schema.sql` (cria clientes, contratos, config; a tabela `prospectos` existe só em bancos antigos, não é mais usada pelo app).

**Banco já existente:** rodar as migrações que faltarem — `migracao-contratos.sql`, `migracao-config.sql` (esta última cria `config`, remove a coluna morta `auth_user_id` e realinha o CHECK de status), `migracao-revisao-jordan.sql` (estágio `rascunho` + colunas da assinatura do Jordan).

Depois: Authentication → Users → Add user (e-mail do Jordan + senha, auto-confirm) e marcar como admin:
```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'e-mail-do-jordan';
```

### Variáveis de ambiente (Vercel)

| Var | O que é |
|---|---|
| `RESEND_API_KEY` | chave do Resend (aviso de cliente novo + via assinada por e-mail) |
| `SUPABASE_URL` | Project URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key; só as functions leem, nunca vai pro browser |
| `SESSION_SECRET` | opcional: segredo dos tokens de sessão (`openssl rand -hex 32`); sem ela, deriva da service key |
| `ADMIN_EMAIL` | opcional (fallback): e-mail tratado como admin |

## E-mail (Resend)

Chave fora do código, como env na Vercel. Sem domínio verificado, o Resend só entrega pro e-mail dono da conta (`jordansantosfotografia@gmail.com`). Remetente atual em `api/_lib/email.js` (`onboarding@resend.dev`); quando o domínio for verificado, trocar a constante `REMETENTE` lá.

## Limites e decisões

- POST na Vercel aceita até ~4.5MB; a função rejeita PDF acima disso (base64 > 6M chars) com HTTP 413. Contrato é texto, fica bem abaixo.
- Catálogo de produtos é **fonte única** em `catalogo.js` (id/preço/nome), consumido por index e estudio — evita rótulo divergente no contrato.
- Entrega de fotos / área do casal: **removida** em 2026-07-13 (Storage não compensava). O vínculo de login do casal (`auth_user_id`) saiu do código e do banco.
- Prospecção (kanban de leads): **removida** em 2026-07-24. O link do orçamento do site geralmente só é mandado depois de uma reunião, pra quem já quer fechar — então o formulário público já coleta tudo que o contrato precisa e cria o cliente direto. `api/prospectos.js` e a tela de kanban saíram do código; a tabela `prospectos` continua existindo em bancos antigos (não foi apagada), só não é mais lida nem escrita pelo app.
- Contatos usando DDD 45: atualizar quando o Jordan migrar pro DDD 41.

## Desenvolvimento local

- **Só visual:** qualquer servidor estático (ex.: `python3 -m http.server 8014`); o que depende de `/api` cai nos avisos de fallback.
- **Com as functions:** `node dev-server.mjs` (usa `.env.local`; porta em `$PORT`, default 8020). O server cacheia os handlers ESM — reinicie após editar arquivos de `api/`. Alternativa: `npx vercel dev`.
