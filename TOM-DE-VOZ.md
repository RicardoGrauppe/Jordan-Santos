# Tom de voz

Guia de escrita pra qualquer texto que aparece nas telas deste app: o painel do
fotógrafo (`/painel/*`), o login, e as telas que o cliente dele abre
(`/cadastro`, `/proposta`, `/assinar`). Vale pra JSX e pra string gerada em
código (mensagem de erro, aviso, texto de WhatsApp, assunto de e-mail).

Portado de `TOM-DE-VOZ.md` do estúdio do Jordan Santos, que é a origem deste
produto, com as regras que vieram depois.

**Não vale pro texto do contrato em si** (`src/lib/contrato-template.ts` e o
conteúdo dos modelos): é documento jurídico, segue convenção própria de redação
legal, e mudar caractere ali tem consequência. As regras deste guia não se
aplicam ao corpo das cláusulas.

## Sem travessão em texto visível

Não usar `—` (nem `&mdash;`/`&ndash;`) pra ligar frases ou marcar aposto em
texto que aparece na tela. Trocar por vírgula, parênteses, dois-pontos, ou
reescrever. Comentário de código não é texto visível: ali pode, e é assim que o
resto do projeto escreve.

- Errado: `"Contrato de Fotografia — " + casal`
  Certo: `"Contrato de Fotografia (" + casal + ")"`
- Errado: `"Não consegui copiar — selecione e copie na mão."`
  Certo: `"Não consegui copiar, selecione e copie na mão."`

Exceção: o caractere sozinho como marca de campo vazio numa lista (`ip || "—"`)
não é prosa, é convenção de dado ausente. Pode continuar.

## Duas vozes, nunca misturadas

**No painel, "você" é o fotógrafo.** É a ferramenta de trabalho dele falando com
ele: "Seus modelos de contrato", "Editar aqui não muda contratos já gerados".

**Nas telas que o cliente dele abre**, a fala é do estúdio, em primeira pessoa
do plural: "Recebemos sua solicitação", "Já está guardado com a gente". Nunca o
estúdio falando de si na terceira pessoa ("O estúdio recebeu"), que soa a
formulário de banco.

A razão é multi-tenant: o texto do painel é do produto, o texto das telas do
casal é do fotógrafo. Quando cada estúdio tiver sua marca, só o segundo muda.

## Nomeie pelo que a pessoa reconhece

O nome da tela é o que o fotógrafo chamaria numa conversa, não o que o sistema
faz por dentro. "Precisa de atenção", não "Pendências do sistema". "Contrato e
assinatura", não "Gestão de templates".

## Português do Brasil

Sempre "você", nunca "tu podes"/"atuas"/"de ti". Números e moeda em padrão
brasileiro nas telas deste produto (R$ 18.600,00, 15 mai 2027).

## Erro fala do que fazer, não do que quebrou

- Errado: "Erro 502 ao processar requisição."
  Certo: "Não consegui salvar agora, tente de novo."

E erro de login responde SEMPRE igual, tenha ou não conta naquele e-mail. Isso
é regra de segurança antes de ser de escrita: ver `CLAUDE.md`.
