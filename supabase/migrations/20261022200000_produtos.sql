-- ───────────────────────── produtos ─────────────────────────
-- Catálogo de produtos e serviços do fotógrafo (pacotes e adicionais), editável
-- em /painel/produtos. Até 22/10/2026 isto morava no código (lib/catalogo.ts)
-- e mudar um preço era deploy.
--
-- `id` é texto e não uuid: é a chave que já vai gravada em clientes.itens[].id
-- e no snapshot dos contratos ("eternal", "civil"...). Os itens de antes
-- entram com as MESMAS chaves pra o que já foi vendido continuar ligado.
--
-- Preço aqui é o de TABELA. O cliente guarda o valor no momento da escolha
-- (clientes.itens[].valor), então mudar o catálogo não mexe em contrato feito.
create table public.produtos (
  id             text primary key,
  tipo           text not null check (tipo in ('pacote', 'adicional')),  -- pacote = escolha única
  nome           text not null,                 -- nome completo: vai pro contrato
  curto          text not null,                 -- rótulo curto das listas
  preco          numeric(12, 2) not null default 0 check (preco >= 0),
  -- pacote que já traz outros itens: com ele escolhido, esses somem da lista
  -- (era a regra fixa "o Eternal já inclui o pré-wedding")
  inclui         text[] not null default '{}',
  ativo          boolean not null default true,  -- desativado some das listas, mas segue nos contratos
  ordem          integer not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
alter table public.produtos enable row level security;

insert into public.produtos (id, tipo, nome, curto, preco, inclui, ordem) values
  ('eternal',    'pacote',    'Pacote 01. Eternal',                       'Pacote 01. Eternal',  18600, '{prewedding}', 10),
  ('heritage',   'pacote',    'Pacote 02. Heritage',                      'Pacote 02. Heritage', 10850, '{}', 20),
  ('welcome',    'adicional', 'Welcome Wedding',                          'Welcome Wedding',      2790, '{}', 30),
  ('fotografo',  'adicional', 'Fotógrafo adicional',                      'Fotógrafo adicional',  1150, '{}', 40),
  ('expressa',   'adicional', 'Entrega Expressa em 7 dias',               'Entrega Expressa',     3500, '{}', 50),
  ('bride',      'adicional', 'Bride Session, ensaio editorial da Noiva', 'Bride Session',        2790, '{}', 60),
  ('hora',       'adicional', 'Hora adicional de cobertura',              'Hora adicional',       1100, '{}', 70),
  ('civil',      'adicional', 'Cobertura fotográfica Casamento Civil',    'Casamento Civil',      2690, '{}', 80),
  ('album-30',   'adicional', 'Álbum 30x60 (50 páginas, 100 imagens)',    'Álbum 30x60',          5500, '{}', 90),
  ('album-20',   'adicional', 'Álbum 20x60 (40 páginas, 60 imagens)',     'Álbum 20x60',          3600, '{}', 100),
  ('prewedding', 'adicional', 'Ensaio Pré Wedding',                       'Ensaio Pré Wedding',   2600, '{}', 110)
on conflict (id) do nothing;
