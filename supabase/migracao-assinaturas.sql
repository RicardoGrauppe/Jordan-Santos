-- Migração: assinaturas do Jordan viram VÁRIAS, nomeadas, com uma padrão.
-- Rodar uma vez no SQL Editor do Supabase. Já aplicada na base de produção;
-- este arquivo existe pra a migração ficar versionada como as outras.
--
-- Substitui public.assinatura_padrao, que era uma tabela de LINHA ÚNICA: a chave
-- primária era um booleano com check(id), então só aceitava id = true e não
-- comportava mais de uma assinatura de jeito nenhum.
--
-- A assinatura marcada como ativo=true é a padrão: é ela que vem aplicada
-- quando o Jordan confirma um contrato em /revisar-contrato. Cada contrato
-- guarda a SUA cópia da assinatura usada (contratos.jordan_assinatura_dataurl),
-- então trocar a padrão nunca mexe em contrato já assinado.

create table if not exists public.assinaturas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null default 'Nova assinatura',  -- rótulo do card em /configuracoes
  tipo           text not null check (tipo in ('cursiva','rubrica','imagem')),
  valor          text not null,   -- cursiva: o texto assinado. rubrica/imagem: data URL do PNG
  ativo          boolean not null default false,           -- é a assinatura padrão
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- garante no BANCO, não só no código, que existe no máximo uma padrão
create unique index if not exists assinaturas_uma_padrao
  on public.assinaturas (ativo) where ativo;

-- mesmo regime das outras tabelas: RLS ligada e sem policy, todo acesso passa
-- pela service-role das rotas em /api
alter table public.assinaturas enable row level security;

comment on table public.assinaturas is
  'Assinaturas salvas do Jordan (/configuracoes > Contrato e assinatura). ativo=true e a padrao, aplicada por default ao confirmar um contrato em /revisar-contrato.';

-- A antiga public.assinatura_padrao ficou órfã e vazia. Não é apagada aqui de
-- propósito: nada mais lê nem escreve nela, e derrubar tabela é decisão do
-- Ricardo, não efeito colateral de migração. Quando quiser:
--   drop table if exists public.assinatura_padrao;
