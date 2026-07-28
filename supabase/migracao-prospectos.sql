-- Migração: página de Prospecção (leads antes de virar cliente).
-- Rodar uma vez no SQL Editor do Supabase (projeto já criado antes de 2026-07-13).

create table public.prospectos (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  status         text not null default 'novo'
                 check (status in ('novo','orcamento_enviado','aguardando_confirmacao','convertido','perdido')),

  nome text, contato text, email text, origem text,
  data_evento date,   -- data provável do evento, se já souber
  observacoes text,

  cliente_id uuid references public.clientes(id)  -- preenchido ao converter em cliente
);

create trigger prospectos_atualizado before update on public.prospectos
  for each row execute function public.tocar_atualizado_em();

alter table public.prospectos enable row level security;
-- RLS ligado sem policies: mesmo padrão de "clientes", só as Vercel Functions
-- (service role) leem/escrevem.
