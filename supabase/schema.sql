-- Schema do site Jordan Santos (rodar uma vez no SQL Editor do Supabase).
-- Fotos NÃO têm tabela: vivem no bucket privado "fotos-clientes" em
-- fotos-clientes/{cliente_id}/{arquivo}; a galeria lista o prefixo no Storage.

create table public.clientes (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  status         text not null default 'novo'
                 check (status in ('novo','confirmado','realizado','fotos_entregues','arquivado')),

  -- casal (CPFs sempre só dígitos, normalizados na aplicação)
  noivo text, cpf_noivo text, noiva text, cpf_noiva text,
  tel_noivo text, tel_noiva text, email text,

  -- endereço (campos do ViaCEP, como no questionário)
  cep text, endereco text, numero text, complemento text,
  bairro text, cidade text, estado text,

  -- evento
  data_evento date, horario time, local_evento text,

  -- contrato: snapshot congelado do que foi contratado
  itens    jsonb not null default '[]'::jsonb,  -- [{"id":"eternal","nome":"...","valor":18600}]
  total    numeric(10,2),
  entrada  numeric(10,2),

  origem text, observacoes text
);

-- lookups do login do casal (cpf de qualquer um dos dois + data do casamento)
create index clientes_cpf_noivo_idx on public.clientes (cpf_noivo, data_evento);
create index clientes_cpf_noiva_idx on public.clientes (cpf_noiva, data_evento);

-- alvo do upsert do questionário (reenvio atualiza, não duplica)
create unique index clientes_upsert_idx on public.clientes (cpf_noivo, data_evento);

-- mantém atualizado_em correto sem código de aplicação
create function public.tocar_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

create trigger clientes_atualizado before update on public.clientes
  for each row execute function public.tocar_atualizado_em();

-- RLS ligado SEM policies: as chaves anon/authenticated não fazem nada.
-- Todo acesso vem das Vercel Functions com a service role (que bypassa RLS).
alter table public.clientes enable row level security;
