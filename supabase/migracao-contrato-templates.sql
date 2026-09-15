-- Migração: editor de template do contrato (Tiptap) no lugar do
-- contrato-template.js hardcoded. Rodar uma vez no SQL Editor do Supabase.
--
-- Nunca edita uma linha existente em contrato_templates — salvar sempre
-- insere uma versão nova e desativa a anterior (mesmo princípio de
-- imutabilidade de contrato_versoes). Cada contrato grava, em
-- contratos.template_id, qual versão estava ativa quando foi gerado, então
-- editar o template depois não muda contratos já em andamento ou assinados.

create table if not exists public.contrato_templates (
  id             uuid primary key default gen_random_uuid(),
  conteudo_json  jsonb not null,
  conteudo_html  text not null,
  ativo          boolean not null default false,
  criado_em      timestamptz not null default now()
);
create unique index if not exists contrato_templates_um_ativo
  on public.contrato_templates (ativo) where ativo;
alter table public.contrato_templates enable row level security;

alter table public.contratos
  add column if not exists template_id uuid references public.contrato_templates(id);
