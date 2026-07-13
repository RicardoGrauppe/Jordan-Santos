-- Migração 2026-07-11: login por e-mail + senha via Supabase Auth.
-- Rodar UMA vez no SQL Editor de um banco que já tem a tabela clientes.
-- (Instalações novas: rodar schema.sql, que já inclui a coluna.)

alter table public.clientes add column if not exists auth_user_id uuid;
create index if not exists clientes_auth_user_idx on public.clientes (auth_user_id);
