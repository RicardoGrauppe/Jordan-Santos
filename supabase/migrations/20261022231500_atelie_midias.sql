/*
  Biblioteca de fotos do Ateliê (22/10/2026).

  O arquivo mora no Supabase Storage (bucket privado `atelie`, criado pelo app
  na primeira foto enviada); esta tabela guarda o que a biblioteca mostra e o
  que o site precisa saber sem abrir o arquivo: nome original, tamanho e
  proporção. O site entrega a foto pela rota /midia/<caminho>.

  A foto chega já reduzida pelo navegador (lado maior até 2560px, JPEG), então
  `largura`/`altura` são as da versão guardada, não as do arquivo da câmera.
*/
create table public.site_midias (
  id         uuid primary key default gen_random_uuid(),
  caminho    text not null unique,        -- nome do arquivo no bucket: <uuid>.jpg
  nome       text not null,               -- nome do arquivo que o fotógrafo escolheu
  tipo       text not null,               -- image/jpeg | image/png | image/webp
  tamanho    integer not null,            -- bytes
  largura    integer,
  altura     integer,
  criado_em  timestamptz not null default now()
);
create index site_midias_criado_idx on public.site_midias (criado_em desc);
alter table public.site_midias enable row level security;
