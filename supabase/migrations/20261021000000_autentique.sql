/*
  Assinatura passa a ser coletada pela Autentique (21/10/2026). O que a gente
  guarda é só o vínculo com o documento de lá e o link do casal; o estado
  (visto, assinado, recusado) continua nas colunas que já existiam, pra todo o
  painel seguir lendo do mesmo lugar.
*/
alter table public.contratos
  add column if not exists autentique_id      text,
  add column if not exists autentique_link    text,
  add column if not exists autentique_sandbox boolean not null default false,
  add column if not exists recusado_em        timestamptz,
  add column if not exists recusa_motivo      text;

create index if not exists contratos_autentique_id_idx on public.contratos (autentique_id);

comment on column public.contratos.autentique_id is
  'id do documento na Autentique; nulo nos contratos assinados pela tela antiga /assinar';
comment on column public.contratos.autentique_link is
  'link curto do casal, que o fotógrafo manda por WhatsApp (a Autentique também avisa por e-mail)';
