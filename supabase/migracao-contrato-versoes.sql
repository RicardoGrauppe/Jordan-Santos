-- Migração: contrato editável até a assinatura do casal, com versionamento.
-- Rodar uma vez no SQL Editor do Supabase (projeto já criado antes de 2026-09-01).
--
-- Antes: a ficha do cliente travava (itens/total/entrada) assim que o Jordan
-- confirmava a assinatura DELE — mesmo que o contrato nunca tivesse saído pro
-- casal. Cedo demais: se a noiva desiste de um item no meio do processo, o
-- Jordan não conseguia corrigir sem cancelar o contrato inteiro e gerar outro.
--
-- Agora: editável a qualquer momento enquanto o CASAL não assinou. Editar
-- depois que o contrato já foi confirmado/enviado gera uma versão nova (a
-- anterior fica preservada aqui, nunca sobrescrita) e exige que o Jordan
-- reconfirme a assinatura dele sobre o conteúdo atualizado antes de liberar de
-- novo. Só `status = 'assinado'` (assinatura do casal) trava de vez.

alter table public.contratos
  add column if not exists versao int not null default 1;

create table if not exists public.contrato_versoes (
  id                        uuid primary key default gen_random_uuid(),
  contrato_id               uuid not null references public.contratos(id) on delete cascade,
  versao                    int not null,
  snapshot                  jsonb not null,
  jordan_assinatura_tipo    text,
  jordan_assinatura_dataurl text,
  jordan_assinatura_nome    text,
  jordan_confirmado_em      timestamptz,
  criado_em                 timestamptz not null default now()
);
create index if not exists contrato_versoes_contrato_idx
  on public.contrato_versoes (contrato_id, versao desc);

-- RLS ligado SEM policies, igual às outras tabelas: só a service role (Vercel
-- Functions) acessa, o que bypassa RLS de qualquer forma.
alter table public.contrato_versoes enable row level security;
