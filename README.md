# Site Jordan Santos Fotografia

Site de proposta comercial do fotógrafo Jordan Santos: o casal monta o orçamento do casamento, gera o contrato preenchido e uma cópia em PDF é enviada automaticamente por e-mail pro Jordan.

Produção: https://jordan-santos.vercel.app (deploy automático a cada push na branch `main`).

## Estrutura

```
index.html               Orçamento interativo (página inicial)
contrato.html            Formulário de fechamento + contrato gerado
api/enviar-contrato.js   Vercel Function: envia o PDF por e-mail via Resend
vercel.json              cleanUrls (URLs sem .html)
img/                     Fotos e logos usados nas páginas
```

Site estático, sem build e sem dependências: HTML, CSS e JS vanilla em arquivo único por página. A única biblioteca externa é o `html2pdf.js`, carregado por CDN no `contrato.html`.

## Fluxo completo

1. **Orçamento** (`/`): o casal escolhe um pacote (Eternal ou Heritage), adicionais, álbum e pré-wedding. O total aparece uma única vez no resumo, e o botão "Gerar contrato" fica ativo.
2. **Passagem de dados**: a seleção viaja pra página do contrato via query string, ex.: `/contrato?p=eternal&x=fotografo,album-20`. Os ids são compartilhados entre as duas páginas pelo objeto `CATALOGO` (duplicado nos dois arquivos de propósito, já que não há build).
3. **Formulário** (`/contrato`): coleta dados do casal, endereço (com autocomplete por CEP via ViaCEP, gratuito e sem chave) e dados do evento.
4. **Geração**: ao clicar em "Gerar contrato", o formulário some e o contrato aparece preenchido na tela (texto integral do modelo docx do Jordan, com tabela de serviços, valor total e entrada de 30% calculada). Essa é a única ação da página.
5. **Envio automático do PDF**: em paralelo, sem bloquear nada:
   - o `html2pdf.js` converte o elemento `#documento` em PDF no próprio navegador (A4, ~1.7MB pra um contrato típico);
   - o PDF vai em base64 num POST pra `/api/enviar-contrato`;
   - a função dispara o e-mail pro Jordan via Resend, com o PDF anexado e um resumo no corpo (casal, telefones, data, local, pacote, valores);
   - o casal vê um aviso discreto de que a cópia foi enviada. Se o envio falhar, o contrato continua na tela e o aviso pede pra avisarem o Jordan por telefone. Falha nunca bloqueia a visualização.

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
- Depois de gerado, o contrato é só visualização. O passo seguinte (assinatura digital via Autentique, por exemplo) fica pra fase 2, por decisão de 2026-07-02.
- E-mail (e não WhatsApp) porque o Jordan pediu isso pra tudo que é documentação/assinatura, na reunião de 23/04/2026.
- Texto do contrato transcrito verbatim do docx do Jordan, inclusive as duas cláusulas numeradas como OITAVA e pequenos erros de digitação do original. Ajustes são do Jordan.
- Contatos usando DDD 45: atualizar quando o Jordan migrar pro DDD 41.

## Desenvolvimento local

Qualquer servidor estático serve, ex.: `python3 -m http.server 8014`. Dois comportamentos só existem em produção: as URLs sem `.html` (cleanUrls da Vercel) e a função de e-mail (`/api`). Localmente, acesse as páginas com `.html` e espere o aviso de fallback no envio.
