-- Migração: preferências do estúdio + limpeza de restos do login do casal.
-- Rodar UMA vez no SQL Editor do Supabase (banco já existente).

-- 1) tabela config (chave/valor): a assinatura do Jordan,
--    lidos server-side e injetados no contrato do casal em /assinar (cross-device).
create table if not exists public.config (
  chave         text primary key,             -- 'assinatura_jordan'
  valor         text,
  atualizado_em timestamptz not null default now()
);
alter table public.config enable row level security;

-- 2) remove o vínculo de login do casal (feature descontinuada em 2026-07)
alter table public.clientes drop column if exists auth_user_id;

-- 3) status 'fotos_entregues' foi descontinuado; realinha o CHECK (zero linhas usam)
alter table public.clientes drop constraint if exists clientes_status_check;
alter table public.clientes add constraint clientes_status_check
  check (status in ('novo','confirmado','realizado','arquivado'));
