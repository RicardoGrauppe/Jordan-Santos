-- Schema completo do site Jordan Santos (setup do zero: rodar UMA vez no SQL Editor).
-- Para um banco já existente, use os arquivos migracao-*.sql em vez deste.
-- Todo acesso vem das Vercel Functions com a service role (que bypassa RLS);
-- RLS fica ligado sem policies, então as chaves anon/authenticated não fazem nada.

-- atualizado_em automático, reusado por clientes e prospectos
create function public.tocar_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

-- ───────────────────────── clientes ─────────────────────────
create table public.clientes (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  status         text not null default 'novo'
                 check (status in ('novo','confirmado','realizado','arquivado')),

  -- casal (CPFs sempre só dígitos, normalizados na aplicação)
  noivo text, cpf_noivo text, noiva text, cpf_noiva text,
  tel_noivo text, tel_noiva text, email text,

  -- endereço (campos do ViaCEP)
  cep text, endereco text, numero text, complemento text,
  bairro text, cidade text, estado text,

  -- evento
  data_evento date, horario time, local_evento text,

  -- contrato: o que foi contratado
  itens    jsonb not null default '[]'::jsonb,  -- [{"id":"eternal","nome":"...","valor":18600}]
  total    numeric(10,2),
  entrada  numeric(10,2),

  origem text, observacoes text
);
create unique index clientes_upsert_idx on public.clientes (cpf_noivo, data_evento);
create trigger clientes_atualizado before update on public.clientes
  for each row execute function public.tocar_atualizado_em();
alter table public.clientes enable row level security;

-- ───────────────────────── prospectos ─────────────────────────
create table public.prospectos (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  status         text not null default 'novo'
                 check (status in ('novo','orcamento_enviado','aguardando_confirmacao','convertido','perdido')),

  nome text, contato text, email text, origem text,
  data_evento date, observacoes text,

  -- itens/valores escolhidos no orçamento do site (viajam pro contrato na conversão)
  itens    jsonb not null default '[]'::jsonb,
  total    numeric(10,2),
  entrada  numeric(10,2),

  cliente_id uuid references public.clientes(id)  -- preenchido ao converter em cliente
);
create trigger prospectos_atualizado before update on public.prospectos
  for each row execute function public.tocar_atualizado_em();
alter table public.prospectos enable row level security;

-- ───────────────────── contrato_templates ─────────────────────
-- Texto do contrato editável pelo Jordan (editor Tiptap em /configuracoes),
-- no lugar do contrato-template.js hardcoded. Nunca edita uma linha existente:
-- salvar sempre insere uma versão nova e desativa a anterior — mesmo
-- princípio de imutabilidade de contrato_versoes (mais abaixo). Cada contrato
-- grava, em contratos.template_id, qual versão estava ativa quando ele foi
-- gerado, então editar o template depois não muda contratos já em andamento
-- ou assinados. Vem ANTES de contratos no arquivo de propósito: a FK precisa
-- da tabela já existir.
create table public.contrato_templates (
  id             uuid primary key default gen_random_uuid(),
  conteudo_json  jsonb not null,   -- doc do Tiptap (fonte editável)
  conteudo_html  text not null,    -- HTML exportado — mesma forma que contrato-template.js
                                    -- produzia (<span class="campo" data-campo="...">, tabela, etc.)
  ativo          boolean not null default false,
  criado_em      timestamptz not null default now()
);
create unique index contrato_templates_um_ativo on contrato_templates (ativo) where ativo;
alter table public.contrato_templates enable row level security;

-- ───────────────────────── contratos ─────────────────────────
-- Assinatura eletrônica simples/avançada, válida entre as partes (MP 2.200-2/2001
-- art. 10 §2º; CC arts. 107 e 219). A trilha abaixo sustenta autoria/integridade.
create table public.contratos (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  token         text not null unique,          -- credencial do link de assinatura
  status        text not null default 'rascunho'
                check (status in ('rascunho','enviado','visualizado','assinado','cancelado')),

  criado_em      timestamptz not null default now(),
  enviado_em     timestamptz,                  -- quando o e-mail saiu de verdade pro casal
  visualizado_em timestamptz,                  -- 1ª abertura do link pelo casal
  verificado_em  timestamptz,                  -- quando o código (OTP) foi validado
  assinado_em    timestamptz,
  expira_em      timestamptz not null,         -- +30 dias no envio

  snapshot      jsonb,                          -- congela o que foi enviado pra assinar
  versao        int not null default 1,         -- sobe a cada edição depois de confirmado/enviado
  template_id   uuid references public.contrato_templates(id),
                                                 -- fixa pra sempre qual versão do TEXTO do contrato
                                                 -- este contrato usa — editar o template depois não muda isto

  -- revisão/confirmação do Jordan (gera → ele revisa e "assina" → libera envio ao casal)
  jordan_confirmado_em     timestamptz,
  jordan_assinatura_tipo   text check (jordan_assinatura_tipo in ('cursiva','manual')),
  jordan_assinatura_dataurl text,               -- PNG base64 (cursiva renderizada ou traço manual)
  jordan_assinatura_nome    text,               -- nome exibido na assinatura cursiva

  -- verificação por 2º fator (código enviado ao e-mail do casal)
  otp_hash      text,                           -- SHA-256 do código, nunca em texto puro
  otp_expira    timestamptz,                    -- +10 min
  verificacao_metodo text,                      -- ex.: 'otp-email'

  -- aceite expresso do método de assinatura eletrônica (MP 2.200-2 §2º)
  aceite_texto  text, aceite_em timestamptz,

  -- identificação do signatário
  signatario_nome text, signatario_cpf text, signatario_email text,

  -- trilha de auditoria (capturada no servidor, não falsificável pelo browser)
  assinante_ip  text, assinante_ua text,
  doc_sha256    text,                           -- integridade do PDF assinado
  pdf_base64    text                            -- PDF assinado (imutável). NÃO usar select *
);
create index contratos_cliente_idx on public.contratos (cliente_id);
create index contratos_status_idx  on public.contratos (cliente_id, status);
alter table public.contratos enable row level security;

-- histórico de versões: toda edição da ficha depois que o contrato já foi
-- confirmado/enviado guarda aqui o snapshot e a assinatura do Jordan que
-- estavam valendo ATÉ a edição, antes de "contratos" ser atualizado pra versão
-- nova. Contrato nunca sobrescreve silenciosamente o que já foi confirmado ou
-- mostrado ao casal — só o que ainda é rascunho não confirmado (ninguém viu).
create table public.contrato_versoes (
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
create index contrato_versoes_contrato_idx on public.contrato_versoes (contrato_id, versao desc);
alter table public.contrato_versoes enable row level security;

-- ───────────────────────── config ─────────────────────────
-- Preferências do estúdio (chave/valor): a assinatura do Jordan.
-- Lida server-side e injetada no contrato do casal em /assinar (cross-device).
create table public.config (
  chave         text primary key,             -- 'assinatura_jordan'
  valor         text,                          -- dataURL da assinatura do Jordan
  atualizado_em timestamptz not null default now()
);
alter table public.config enable row level security;
