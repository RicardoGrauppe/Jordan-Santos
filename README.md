# Site Jordan Santos Fotografia

Site de proposta comercial do fotógrafo Jordan Santos: o casal monta o orçamento do casamento e, depois de confirmar a data com o Jordan no WhatsApp, recebe o link do questionário de contrato. Ao enviar as respostas, o contrato preenchido segue automaticamente em PDF por e-mail pro Jordan; o casal vê só uma confirmação.

Produção: https://jordan-santos.vercel.app (deploy automático a cada push na branch `main`).

## Estrutura

```
index.html               Orçamento interativo (página inicial)
contrato.html            Questionário de fechamento (contrato invisível vira PDF)
api/enviar-contrato.js   Vercel Function: envia o PDF por e-mail via Resend
vercel.json              cleanUrls (URLs sem .html)
img/                     Fotos e logos usados nas páginas
```

Site estático, sem build e sem dependências: HTML, CSS e JS vanilla em arquivo único por página. A única biblioteca externa é o `html2pdf.js`, carregado por CDN no `contrato.html`.

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

O `vercel.json` usa `"cleanUrls": true`: nenhuma URL leva `.html`. A raiz `/` serve o `index.html` (orçamento) e `/contrato` serve o `contrato.html`. Quem acessar com `.html` é redirecionado pela própria Vercel.

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

Qualquer servidor estático serve, ex.: `python3 -m http.server 8014`. Dois comportamentos só existem em produção: as URLs sem `.html` (cleanUrls da Vercel) e a função de e-mail (`/api`). Localmente, acesse as páginas com `.html` e espere o aviso de fallback no envio.
