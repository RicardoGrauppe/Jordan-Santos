-- Migração: assinatura eletrônica de contrato dentro da plataforma.
-- Rodar uma vez no SQL Editor do Supabase (projeto já criado antes de 2026-07-13).
--
-- O Jordan gera o contrato pra assinatura no /estudio; o casal assina em /assinar
-- (link tokenizado, sem login). Assinatura eletrônica simples/avançada, válida entre
-- as partes (MP 2.200-2/2001 art. 10 §2º; Código Civil arts. 107 e 219). A trilha de
-- evidências abaixo é o que sustenta a autoria/integridade caso vá pro jurídico.

create table public.contratos (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  token         text not null unique,          -- credencial do link de assinatura
  status        text not null default 'enviado'
                check (status in ('enviado','visualizado','assinado','cancelado')),

  criado_em     timestamptz not null default now(),
  visualizado_em timestamptz,                  -- 1ª abertura do link pelo casal
  verificado_em timestamptz,                   -- quando o código (OTP) foi validado
  assinado_em   timestamptz,
  expira_em     timestamptz not null,          -- +30 dias no envio

  -- snapshot congelado do que foi enviado pra assinar (não muda se o cliente for editado)
  snapshot      jsonb,

  -- verificação por 2º fator (código enviado ao e-mail do casal)
  otp_hash      text,                          -- SHA-256 do código, nunca em texto puro
  otp_expira    timestamptz,                   -- +10 min
  verificacao_metodo text,                     -- ex.: 'otp-email'

  -- aceite expresso do método de assinatura eletrônica (MP 2.200-2 §2º)
  aceite_texto  text,                          -- texto exato da cláusula marcada
  aceite_em     timestamptz,

  -- identificação do signatário
  signatario_nome  text,
  signatario_cpf   text,
  signatario_email text,

  -- trilha de auditoria (capturada no servidor, não falsificável pelo browser)
  assinante_ip  text,
  assinante_ua  text,
  doc_sha256    text,                          -- integridade do PDF assinado
  pdf_base64    text                           -- o PDF assinado (imutável). NÃO usar select *
);

create index contratos_cliente_idx on public.contratos (cliente_id);
create index contratos_status_idx  on public.contratos (cliente_id, status);

-- mantém atualizado? não: os timestamps deste registro são por evento (criado/visualizado/
-- verificado/assinado), então não há coluna atualizado_em nem trigger.

-- RLS ligado SEM policies: as chaves anon/authenticated não fazem nada.
-- Todo acesso vem das Vercel Functions com a service role (que bypassa RLS).
alter table public.contratos enable row level security;
