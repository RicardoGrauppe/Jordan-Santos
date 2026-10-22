/*
  Versões publicadas do Ateliê (22/10/2026).

  Toda vez que um modelo vai pro ar (Pôr no ar / Publicar mudanças), o que foi
  publicado ganha uma linha aqui. É a rede de segurança do fotógrafo: publicou
  algo errado, abre "Versões publicadas", vê como era e restaura no rascunho.
  Restaurar não publica sozinho; publicar continua sendo um clique dele.

  Guarda as 30 mais recentes de cada modelo (o app apaga as mais antigas).
  Apagar o modelo leva as versões junto.
*/
create table public.site_versoes (
  id            uuid primary key default gen_random_uuid(),
  modelo_id     uuid not null references public.site_modelos (id) on delete cascade,
  dados         jsonb not null,
  publicado_em  timestamptz not null default now()
);
create index site_versoes_modelo_idx on public.site_versoes (modelo_id, publicado_em desc);
alter table public.site_versoes enable row level security;
