# Site Jordan Santos Fotografia

Site de proposta comercial do fotógrafo Jordan Santos: o casal monta o orçamento do casamento e, depois de confirmar a data com o Jordan no WhatsApp, recebe o link do questionário de contrato. Ao enviar as respostas, o contrato preenchido segue automaticamente em PDF por e-mail pro Jordan; o casal vê só uma confirmação.

Produção: https://jordan-santos.vercel.app (deploy automático a cada push na branch `main`).

## Estrutura

```
index.html               Orçamento interativo (página inicial)
contrato.html            Questionário de fechamento (contrato invisível vira PDF)
cliente.html             Área do casal (/cliente): datas, contrato e fotos entregues
estudio.html             Painel do Jordan (/estudio): CRUD de clientes + upload de fotos
api/enviar-contrato.js   Vercel Function: e-mail com PDF via Resend + cadastro no Supabase
api/sessao.js            Vercel Function: logins (casal e estúdio) e logout
api/portal.js            Vercel Function: dados da área do casal
api/estudio.js           Vercel Function: CRUD do painel + URLs assinadas de upload
api/_lib/                Helpers compartilhados (não viram functions)
supabase/schema.sql      DDL do banco (rodar uma vez no SQL Editor do Supabase)
vercel.json              cleanUrls (URLs sem .html)
img/                     Fotos e logos usados nas páginas
```

Site estático, sem build e sem dependências: HTML, CSS e JS vanilla em arquivo único por página. A única biblioteca externa é o `html2pdf.js`, carregado por CDN no `contrato.html`. Os dados das contas vivem no **Supabase** (Postgres + Storage), acessado só pelas functions com a service role key.

## Fluxo completo — duas páginas independentes

O site trabalha com **duas páginas desconectadas** (decisão de 2026-07-06, revisada em 2026-07-09: nada passa de uma pra outra):

- **Página 1 (pública, portfólio + calculadora):** `https://jordan-santos.vercel.app/` — o Jordan envia pra qualquer interessado ver o trabalho, calcular preços e chamar no WhatsApp pra verificar a disponibilidade da data. **Não leva ao contrato.**
- **Página 2 (fechamento):** `https://jordan-santos.vercel.app/contrato` — URL fixa, sem parâmetros. O Jordan envia só depois que o casal confirmou a data com ele no WhatsApp. Não é linkada em lugar nenhum do site público (obscuridade, não segurança — suficiente aqui).

Passo a passo:

1. **Orçamento** (`/`): o casal escolhe um pacote (Eternal ou Heritage), adicionais, álbum e pré-wedding só pra ver o preço. O total aparece uma única vez no resumo. O CTA é **"Enviar orçamento pro Jordan"** — abre o WhatsApp do Jordan com a seleção e o total pré-preenchidos. É nessa conversa que a data é verificada e confirmada.
2. **Questionário** (`/contrato`, remodelado em 2026-07-09 no fluxo do site de referência yoshioyoneoka-contrato.netlify.app): o casal **reescolhe os serviços** na seção "Os serviços" (pacote obrigatório via rádio + adicionais, álbuns e pré-wedding opcionais; total e entrada de 30% atualizam ao vivo; escolher o Eternal trava o pré-wedding como "incluso") e preenche os dados que entram no contrato: casal (nomes, CPFs, celulares, e-mail), endereço (autocomplete por CEP via ViaCEP, gratuito e sem chave), evento (data, horário, local), origem e observações. Os ids e preços vêm do mesmo objeto `CATALOGO` do index (duplicado nos dois arquivos de propósito, já que não há build). O CTA é **"Enviar informações"**.
3. **Envio**: ao enviar, o casal vê só a tela de confirmação ("Obrigado pela confiança"), sem o contrato. Por trás, sem bloquear nada:
   - o contrato completo (texto integral do modelo docx do Jordan, com tabela de serviços, total e entrada de 30%) é montado num elemento fora da tela (`#documento`, `position:absolute; left:-10000px` — `display:none` quebraria a captura);
   - o `html2pdf.js` converte esse elemento em PDF no próprio navegador (A4, ~1.7MB pra um contrato típico);
   - o PDF vai em base64 num POST pra `/api/enviar-contrato`;
   - a função dispara o e-mail pro Jordan via Resend, com o PDF anexado e um resumo no corpo (casal, telefones, e-mail, data, local, pacote, valores, origem, observações);
   - o status aparece na tela de confirmação. Se o envio falhar, o aviso pede pra chamarem o Jordan por telefone. Falha nunca bloqueia a confirmação.
4. **Próximo passo (com o Jordan)**: ele recebe o PDF pronto, revisa e retorna pro casal com o contrato pra assinatura (assinatura digital fica pra fase 2).

## URLs

O `vercel.json` usa `"cleanUrls": true`: nenhuma URL leva `.html`. A raiz `/` serve o `index.html` (orçamento), `/contrato` o questionário, `/cliente` a área do casal e `/estudio` o painel do Jordan (não linkado em lugar nenhum do site público). Quem acessar com `.html` é redirecionado pela própria Vercel.

## Contas e área logada (2026-07-11)

Além das duas páginas públicas, o site tem uma camada de contas em cima do **Supabase**:

Os dois logins usam **e-mail + senha via Supabase Auth** (decisão de 2026-07-11; a senha vive hasheada no Supabase, nunca aqui). As functions validam a credencial no Auth e abrem a sessão própria do site (cookie HMAC), então o resto do sistema não conhece senhas.

- **`/estudio` (Jordan):** login com o e-mail dele (identificado pela env `ADMIN_EMAIL`; o usuário é criado à mão no painel do Supabase). CRUD completo de clientes (lista com busca e filtro, detalhe editável, criar manualmente, arquivar, excluir de vez), upload das fotos da entrega e o bloco **"Acesso do casal"**: gera a senha temporária do casal e copia uma mensagem pronta pro WhatsApp. O upload vai do navegador **direto pro Supabase Storage** via URLs assinadas geradas por `/api/estudio` (contorna o limite de 4.5MB de body da Vercel). Fotos em `fotos-clientes/{cliente_id}/`.
- **`/cliente` (casal):** login com o e-mail do contrato + a senha que o Jordan enviou. Hub com o grande dia (data, horário, local, contagem regressiva), o combinado (itens, total, entrada de 30%), status, a galeria das fotos entregues com download, e **troca de senha** (senha atual + nova). Esqueceu a senha: o Jordan gera outra temporária no `/estudio` (reset por e-mail automático fica pra quando o domínio estiver verificado no Resend, que hoje só entrega pro e-mail do dono da conta). A área nunca mostra CPF nem endereço.
- **Cadastro automático:** ao enviar o questionário (`/contrato`), além do e-mail com o PDF, a function faz upsert do casal na tabela `clientes` (chave `cpf_noivo + data_evento`; reenvio atualiza, não duplica) e cria o usuário do Auth vinculado (`auth_user_id`), com senha aleatória descartada: a senha real é a temporária que o Jordan gera. E-mail, cadastro e vínculo de acesso são independentes: um falhar nunca bloqueia os outros.
- **Sessões:** token HMAC-SHA256 (Web Crypto, segredo em `SESSION_SECRET`) num cookie `HttpOnly; Secure; SameSite=Lax`. Estúdio 7 dias, casal 30 dias. Sem tabela de sessões.
- **Mitigações:** espera de ~800ms e erro genérico em falha de login, throttle best-effort por IP, RLS ligado sem policies (anon key não faz nada), bucket privado com URLs assinadas de 1h.

### Setup do Supabase (uma vez)

1. Criar projeto em https://supabase.com (free tier), região `sa-east-1` (São Paulo).
2. SQL Editor → rodar o conteúdo de `supabase/schema.sql` (banco já criado antes de 2026-07-11: rodar também `supabase/migracao-auth-email.sql`).
3. Storage → New bucket → nome `fotos-clientes`, **privado** (public off).
4. Authentication → Users → **Add user**: e-mail do Jordan + senha dele, com auto-confirm. Esse e-mail vai na env `ADMIN_EMAIL`.
5. Settings → API: copiar a Project URL e a `service_role` key pras env vars abaixo.

### Variáveis de ambiente (Vercel)

| Var | O que é |
|---|---|
| `RESEND_API_KEY` | chave do Resend (e-mail do contrato) |
| `SUPABASE_URL` | Project URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key; só as functions leem, nunca vai pro browser |
| `SESSION_SECRET` | segredo dos tokens de sessão (`openssl rand -hex 32`) |
| `ADMIN_EMAIL` | e-mail do usuário do Jordan no Supabase Auth (login do `/estudio`) |

Sem as vars do Supabase, o site público continua 100% funcional: o questionário só envia o e-mail (`cadastroOk:false`) e as áreas logadas avisam que o banco não está configurado.

## E-mail (Resend)

A chave fica **fora do código**, como variável de ambiente na Vercel. Configuração (uma vez):

1. Criar conta em https://resend.com **com o e-mail do Jordan** (`jordansantosfotografia@gmail.com`). Sem domínio verificado, o Resend só entrega pro e-mail dono da conta, e é exatamente pra ele que o site envia. Plano grátis: 3.000 e-mails/mês.
2. Gerar uma API Key no painel do Resend.
3. Na Vercel, projeto Jordan-Santos: Settings > Environment Variables > criar `RESEND_API_KEY` com a chave > Redeploy.

Enquanto a chave não existir, o site funciona normalmente e o envio cai no aviso de fallback.

**Fase 2 (domínio verificado):** quando o domínio `jordansantosfotografia.com.br` for verificado no Resend, trocar a constante `REMETENTE` em `api/enviar-contrato.js` pra algo como `Contratos <contrato@jordansantosfotografia.com.br>`.

## Limites e decisões

- O corpo do POST na Vercel aceita até 4.5MB; a função rejeita PDFs acima de ~4.5MB (base64 > 6M chars) com HTTP 413. O contrato é texto puro, fica bem abaixo disso.
- O casal não vê o contrato na tela (decisão de 2026-07-09): a página é um questionário e o contrato segue direto pro Jordan, que revisa e retorna pro casal. Assinatura digital (Autentique, por exemplo) fica pra fase 2, por decisão de 2026-07-02.
- E-mail (e não WhatsApp) porque o Jordan pediu isso pra tudo que é documentação/assinatura, na reunião de 23/04/2026.
- Texto do contrato transcrito verbatim do docx do Jordan, inclusive as duas cláusulas numeradas como OITAVA e pequenos erros de digitação do original. Ajustes são do Jordan.
- Contatos usando DDD 45: atualizar quando o Jordan migrar pro DDD 41.

## Desenvolvimento local

- **Só páginas (visual):** qualquer servidor estático serve, ex.: `python3 -m http.server 8014`. Acesse com `.html`; tudo que depende de `/api` cai nos avisos de fallback.
- **Com as functions:** `npx vercel dev` na raiz do repo (o npx baixa a CLI na hora; o repo continua sem package.json). Antes, `npx vercel link` e `npx vercel env pull .env.local` pra trazer as env vars (o `.gitignore` já cobre `.env*`). Alternativa sem tooling local: push numa branch e testar no preview deploy da Vercel.
