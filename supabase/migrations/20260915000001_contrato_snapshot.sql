-- Congela o conteúdo do modelo dentro do próprio contrato no momento da
-- geração. As telas do casal (/assinar) e o PDF leem daqui, nunca do modelo:
-- editar um modelo em /painel/configuracoes/contrato não muda contrato já
-- gerado.
--
-- Estas colunas existem na base de produção do estúdio de origem, mas nunca
-- foram versionadas no schema.sql de lá (só citadas em comentário). Aqui
-- entram como migração própria pra `supabase db reset` reproduzir o banco
-- inteiro.

alter table public.contratos
  add column if not exists template_nome          text,
  add column if not exists template_html_snapshot text,
  add column if not exists template_json_snapshot jsonb;
