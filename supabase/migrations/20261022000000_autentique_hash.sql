/*
  "O contrato mudou depois de ir pra Autentique?" (22/10/2026)

  A Autentique não deixa trocar o PDF de um documento já criado (updateDocument
  só mexe em nome, mensagem e configurações; conferido na introspecção da API).
  Então atualizar = apagar lá e criar de novo, e isso só pode acontecer quando
  houver mudança DE VERDADE, porque cada documento gasta cota e troca o link do
  casal.

  Guarda o hash do que foi enviado (texto do contrato + dados do casal). Se o
  hash de agora for diferente, o painel oferece "Atualizar na Autentique".
  Hash e não flag: editar e desfazer a edição volta ao mesmo hash, e aí não há
  nada pra reenviar.
*/
alter table public.contratos
  add column if not exists autentique_hash text;
