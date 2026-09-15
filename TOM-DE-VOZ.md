# Tom de voz — Jordan Santos Fotografia (app)

Guia de escrita pra qualquer texto que aparece nas telas deste site (admin em
`/estudio` e `/configuracoes`, ou voltado ao casal em `/cadastro`, `/assinar`,
`/revisar-contrato`, `index.html`). Vale pra HTML estático e pra string gerada
em JS (`textContent`, `innerHTML`, mensagens de erro, avisos, WhatsApp).

Não vale pro texto do **contrato em si** (`contrato-template.js`): é
documento jurídico, seguindo convenção própria de redação legal em
português, e qualquer mudança de caractere ali exige regerar os templates de
PDF (`npm run contrato:regerar` — ver aviso no topo do arquivo). Regras deste
guia não se aplicam ao corpo das cláusulas.

Regras já em vigor, adicione novas conforme surgirem:

## Sem travessão/travessinha (—) em texto visível

Não usar `—` (nem `&mdash;`/`&ndash;`) pra ligar frases ou marcar aposto em
texto que aparece na tela. Trocar por vírgula, parênteses, ou reescrever a
frase. Comentário de código (`/* ... */`, `<!-- ... -->`) não é "texto
visível" — pode continuar usando `—` normalmente, é assim que o resto do
código deste projeto já escreve os comentários.

Exemplos:
- ❌ `"Contrato de Fotografia — " + casal`
  ✅ `"Contrato de Fotografia (" + casal + ")"`
- ❌ `"Não consegui copiar — selecione e copie na mão."`
  ✅ `"Não consegui copiar, selecione e copie na mão."`

Exceção: o caractere "—" sozinho como placeholder de campo vazio numa lista
(ex.: `contrato.assinante_ip || "—"`, "CPF: —") não é prosa, é convenção de
tabela/dado ausente — pode continuar.
