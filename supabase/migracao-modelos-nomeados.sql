-- Migração: modelo de contrato passa a ser NOMEADO e editável in place.
-- Rodar uma vez no SQL Editor do Supabase. Já aplicada na base de produção;
-- este arquivo existe pra a migração ficar versionada como as outras.
--
-- Muda o modelo mental de contrato_templates. A migracao-contrato-templates.sql
-- dizia que a tabela era imutável ("salvar sempre insere uma versão nova e
-- desativa a anterior"). Não é mais: agora o Jordan tem VÁRIOS modelos com nome,
-- abre um e edita, e o salvamento é automático em cima da mesma linha.
--
-- Isso continua sem afetar contrato já gerado, mas por outro motivo: a geração
-- congela o conteúdo do modelo dentro do próprio contrato
-- (contratos.template_html_snapshot / template_json_snapshot / template_nome),
-- e as telas e o PDF leem o snapshot. O template_id ficou só como referência de
-- origem, pra contratos antigos gerados antes do snapshot existir.

alter table public.contrato_templates
  add column if not exists nome text not null default 'Novo modelo';

alter table public.contrato_templates
  add column if not exists atualizado_em timestamptz not null default now();

-- `ativo` deixou de significar "é a versão vigente" e passou a significar
-- "é o modelo padrão", que é o usado quando um contrato novo é gerado. O índice
-- único criado na migração anterior continua valendo e agora garante que só um
-- modelo seja o padrão:
--   contrato_templates_um_ativo on contrato_templates (ativo) where ativo
