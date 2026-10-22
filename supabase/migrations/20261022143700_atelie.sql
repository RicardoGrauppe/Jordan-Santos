/*
  Ateliê (22/10/2026): os modelos de site que o fotógrafo monta com blocos.

  Cada linha é um modelo (uma página longa, como a proposta). O conteúdo é o
  JSON do editor (Puck): `rascunho` é o que está sendo editado e salva sozinho;
  `publicado` é a última versão que o fotógrafo mandou pro ar. O público só
  vê `publicado`, e só do modelo ativo, então editar nunca mostra texto pela
  metade pra quem abre o link.

  Qual modelo está no ar fica em `config` (chave `site_ativo`, valor = id),
  como as outras preferências do estúdio: trocar o site é trocar essa chave.

  Sem coluna de dono por enquanto: o app tem um fotógrafo só (decisão de
  2026-09-16, ver "Dívidas conhecidas" no CLAUDE.md).
*/
create table public.site_modelos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  rascunho       jsonb not null,
  publicado      jsonb,
  publicado_em   timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
alter table public.site_modelos enable row level security;
