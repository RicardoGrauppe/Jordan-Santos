-- Migração: prospecto carrega os itens/valores escolhidos no orçamento do site,
-- pra que a conversão em cliente já traga pacote + adicionais preenchidos no contrato.
-- Rodar uma vez no SQL Editor do Supabase.

alter table public.prospectos
  add column if not exists itens jsonb not null default '[]'::jsonb,  -- [{"id","nome","valor"}]
  add column if not exists total numeric(10,2),
  add column if not exists entrada numeric(10,2);
