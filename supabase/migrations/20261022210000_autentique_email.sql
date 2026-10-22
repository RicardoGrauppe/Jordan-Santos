-- Status do e-mail que a Autentique manda pro casal (enviado, entregue,
-- aberto, recusado + motivo), copiado de signatures.email_events a cada
-- sincronização. Existe desde que a entrega voltou a ser por e-mail
-- (22/10/2026): é o que deixa a ficha dizer "entregue" ou "voltou: caixa
-- cheia" em vez de o fotógrafo descobrir pelo casal.
alter table public.contratos add column if not exists autentique_email jsonb;
