/*
  Respostas das perguntas que o fotógrafo cria no formulário de cadastro
  (/painel/formulario, 22/10/2026).

  Os campos que já existiam continuam nas colunas de sempre. Pergunta nova não
  tem coluna: entra aqui como [{"id","rotulo","tipo","valor"}], com o TEXTO da
  pergunta copiado no envio, pra a resposta continuar legível depois que a
  pergunta for renomeada ou apagada.
*/
alter table public.clientes
  add column if not exists respostas_formulario jsonb not null default '[]'::jsonb;
