-- Migração: revisão/confirmação do Jordan antes de enviar o contrato pro casal.
-- Rodar uma vez no SQL Editor do Supabase (projeto já rodou migracao-contratos.sql antes).
--
-- Fluxo novo (2026-07-25): "Gerar contrato" já salva o contrato (rascunho), sem
-- depender de assinatura pra existir, e abre a página de revisão pro Jordan. Só
-- depois que ele confirma (assinatura em cursiva com o nome, ou desenhada na mão)
-- é que o botão "Enviar pro cliente" libera — manda o link de verdade (com OTP)
-- pro e-mail do casal, aí sim entrando no fluxo antigo de assinar.html.

alter table public.contratos drop constraint contratos_status_check;
alter table public.contratos add constraint contratos_status_check
  check (status in ('rascunho','enviado','visualizado','assinado','cancelado'));
alter table public.contratos alter column status set default 'rascunho';

alter table public.contratos add column jordan_confirmado_em timestamptz;
alter table public.contratos add column jordan_assinatura_tipo text
  check (jordan_assinatura_tipo in ('cursiva','manual'));
alter table public.contratos add column jordan_assinatura_dataurl text; -- PNG base64 (cursiva renderizada ou traço manual)
alter table public.contratos add column jordan_assinatura_nome text;    -- nome exibido na assinatura cursiva

-- quando o e-mail com o link foi REALMENTE disparado pro casal. Antes a timeline
-- usava criado_em como "enviado", o que mentia: o contrato nascia já marcado como
-- enviado (e o próprio Jordan abrindo o link marcava "visualizado" em milissegundos).
alter table public.contratos add column enviado_em timestamptz;
